// server/app/routes/openaiRoute.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { OpenAI } = require('openai');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const { parseCityState } = require('../lib/location')
const { buildPlaceSummary } = require('../lib/composePlaceSummary')
const { LRUCache } = require('../lib/cache')

/* ----------------------------- OpenAI client ----------------------------- */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ----------------------------- Multer (audio) ---------------------------- */
// Use memoryStorage so we can size-check and cleanly write temp files
const storage = multer.memoryStorage();
const upload = multer({ storage });

/* ---------------------- In-memory guided flow sessions ------------------- */
/**
 * sessions: Map<sessionId, {
 *   mode: 'relocation' | 'free',
 *   step: number,
 *   answers: Record<string,string>,
 *   startedAt: number
 * }>
 */
const SESSIONS = new Map();

/* ------------------------ Allowlist for free chat ------------------------ */
const ALLOW_TERMS = [
  'relocat', 'moving', 'move', 'neighborhood', 'neighbourhood', 'area', 'district',
  'explore', 'exploring', 'local', 'nearby', 'around me', 'close by',
  'weather', 'safety', 'crime', 'safe', 'schools', 'education',
  'commute', 'transport', 'public transit', 'bus', 'train', 'subway', 'parking',
  'rent', 'rental', 'apartment', 'housing', 'cost of living',
  'parks', 'places', 'restaurants', 'cafes', 'coffee', 'groceries',
  'gyms', 'hospitals', 'clinics', 'pharmacy',
  'zip code', 'zipcode', 'postal code', 'city', 'town', 'suburb', 'downtown', 'uptown'
];

const isOnTopic = (s = '') => ALLOW_TERMS.some(t => String(s).toLowerCase().includes(t));

/* ---------------------- Guided Relocation Questionnaire ------------------ */
const RELOCATION_QUESTIONS = [
  { key: 'destinationCity', q: 'Which city are you moving to?' },
  { key: 'partySize', q: 'How many people are relocating (adults/kids)?' },
  { key: 'monthlyBudget', q: 'What is your approximate monthly housing budget (USD)?' },
  { key: 'commutePrefs', q: 'What’s your ideal commute (minutes) and mode (car/public transit/walk)?' },
  { key: 'safetyPriority', q: 'How important is safety on a scale of 1–5 (and any specific concerns)?' },
  { key: 'lifestyleInterests', q: 'Any lifestyle interests to prioritize? (e.g., quiet, nightlife, parks, cafes, schools)' }
];

function ensureRelocationSession(sessionId) {
  if (!SESSIONS.has(sessionId)) {
    SESSIONS.set(sessionId, {
      mode: 'relocation',
      step: 0,
      answers: {},
      startedAt: Date.now()
    });
  }
  return SESSIONS.get(sessionId);
}

function endSession(sessionId) {
  const s = SESSIONS.get(sessionId);
  if (s) s.mode = 'free';
}

/* ------------------------------ Place summary detection + cache ---------------------------- */
const SUMMARY_TRIGGERS = [
  'summary of', 'tell me about', 'about', 'city summary', 'overview of', 'info on', 'information on'
];

function isPlaceSummaryPrompt(s = '') {
  const str = String(s).toLowerCase()
  return SUMMARY_TRIGGERS.some(t => str.includes(t))
}

const placeCache = new LRUCache({ max: 200, ttlMs: 1000 * 60 * 10 })

/* ------------------------------ /api/generate ---------------------------- */
/**
 * Body:
 *  - prompt: string
 *  - sessionId: string
 *  - relocationMode?: boolean  (explicit from client)
 *  - reset?: boolean           (optional: resets flow)
 */
router.post('/generate', async (req, res) => {
  try {
    const { prompt = '', sessionId = 'default', relocationMode = false, reset = false } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Reset session if requested
    if (reset) {
      SESSIONS.delete(sessionId);
      return res.json({ reply: 'Relocation session reset. Say “I want to relocate to <city>” to begin.' });
    }

    /* ---------- New: Place summary orchestrator (runs before relocation) ---------- */
    if (isPlaceSummaryPrompt(prompt)) {
      const place = parseCityState(prompt);
      if (place?.city && place?.state) {
        const key = `place:${place.city},${place.state}`;
        const data = await placeCache.wrap(key, async () => {
          return await buildPlaceSummary({ city: place.city, state: place.state });
        });

        const reply = `Here's a summary of ${place.city}, ${place.state}.`;
        return res.json({
          reply,
          ui: { type: 'place_summary', data },
          meta: { mode: 'place_summary' }
        });
      }
      // If we didn't parse a {city,state}, just fall through to your normal flows
    }

    // Only auto-detect relocation when client didn't explicitly choose a mode
    const looksLikeRelocation = /(relocat|move|moving|new city)/i.test(prompt);
    const clientSpecified = Object.prototype.hasOwnProperty.call(req.body, 'relocationMode');
    const shouldUseRelocation = relocationMode || (!clientSpecified && looksLikeRelocation);

    /* ------------------------ Guided relocation flow ------------------------ */
    if (shouldUseRelocation) {
      const sess = ensureRelocationSession(sessionId);

      // Treat current prompt as the answer to the previous question (if any)
      if (sess.step > 0 && sess.step <= RELOCATION_QUESTIONS.length) {
        const prevKey = RELOCATION_QUESTIONS[sess.step - 1].key;
        sess.answers[prevKey] = String(prompt).trim();
      }

      // Ask next question if any remain
      if (sess.step < RELOCATION_QUESTIONS.length) {
        const nextQ = RELOCATION_QUESTIONS[sess.step].q;
        sess.step += 1;
        return res.json({ reply: nextQ, meta: { mode: 'relocation', step: sess.step } });
      }

      // All questions answered → produce the plan
      const a = sess.answers;

      const sys = `
You are LocalGenie, a relocation expert.
Greet the user with welcome message.
Produce a clear actionable "recommadation" of neighbourhood.
Tone: friendly, clear, practical. Keep it scannable with short bullets.
Sections to include (only if relevant): Neighborhood Matches, Budget & Housing, Commute, Safety, Schools (if kids), Essentials & Next Steps.

      `.trim();

      const user = `
User relocation details:
- Destination city: ${a.destinationCity || 'n/a'}
- Party size: ${a.partySize || 'n/a'}
- Monthly housing budget: ${a.monthlyBudget || 'n/a'}
- Commute preferences: ${a.commutePrefs || 'n/a'}
- Safety priority: ${a.safetyPriority || 'n/a'}
- Lifestyle interests: ${a.lifestyleInterests || 'n/a'}

Generate the personalized relocation summary now.
      `.trim();

      const gpt = await openai.chat.completions.create({
        model: 'gpt-4',
        temperature: 0.4,
        max_tokens: 450,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user }
        ]
      });

      const finalText =
        gpt.choices?.[0]?.message?.content?.trim() ||
        'Here is your personalized relocation plan.';

      endSession(sessionId);

      return res.json({ reply: finalText, meta: { mode: 'relocation', done: true } });
    }

    /* -------------------- On-topic free chat (exploring) -------------------- */
    if (!isOnTopic(prompt)) {
      return res.json({
        reply:
          "I’m focused on relocation and local exploration. Try asking about neighborhoods, safety, weather, schools, commutes, housing or places to visit.",
        meta: { mode: 'free' }
      });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      temperature: 0.4,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content:
            "You are LocalGenie. Keep answers short and useful. Only cover moving, neighborhoods, local amenities, safety, weather, schools, commutes, housing, and things to do. If off-topic, decline briefly."
        },
        { role: 'user', content: prompt }
      ]
    });

    const aiReply =
      response.choices?.[0]?.message?.content?.trim() ||
      "I’m focused on relocation and local exploration.";
    return res.json({ reply: aiReply, meta: { mode: 'free' } });

  } catch (err) {
    console.error('OpenAI Error:', err?.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to get response from OpenAI' });
  }
});

/* ---------------- Whisper: /api/whisper & /api/whisper/transcribe -------- */
/**
 * Returns: { transcript: string, warning?: 'no_text' }
 * - Adds tiny-blob guard
 * - Adds domain prompt to improve accuracy
 */
async function handleTranscription(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Audio file is required' });

  try {
    const buffer = req.file.buffer || null;

    // 🛡️ Tiny blob guard — avoids wasted Whisper calls on silence
    const MIN_BYTES = 2000; // ~2KB
    if (!buffer || buffer.length < MIN_BYTES) {
      return res.json({ transcript: '', warning: 'no_text' });
    }

    // Determine extension from mimetype so Whisper gets a sane file name
    const mt = req.file.mimetype || '';
    const ext = /ogg/.test(mt) ? 'ogg' : 'webm';
    const tempDir = path.join(__dirname, '../temp');
    const tempPath = path.join(tempDir, `audio-${Date.now()}.${ext}`);

    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(tempPath, buffer);

    // Prefer a newer model if available; fall back to whisper-1
    const model = process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1';

    // Domain bias prompt helps with names/terms we expect
    const domainPrompt = "LocalGenie assistant about neighborhoods, relocation, weather, safety, schools, commute, and local places in US cities such as Chicago, New York, San Francisco.";

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model,
      prompt: domainPrompt,
      // response_format: 'json', // whisper-1 is JSON by default
      language: 'en',
      temperature: 0
    });

    try { fs.unlinkSync(tempPath); } catch { }

    const text = (transcription?.text || '').trim();

    if (!text) {
      return res.json({ transcript: '', warning: 'no_text' });
    }
    return res.json({ transcript: text });
  } catch (err) {
    console.error('Whisper Error:', err?.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to transcribe audio' });
  }
}

router.post('/whisper', upload.single('audio'), handleTranscription);
router.post('/whisper/transcribe', upload.single('audio'), handleTranscription);

module.exports = router;

/*
// server/app/routes/openaiRoute.js

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { OpenAI } = require('openai');
const path = require('path');
const fs = require('fs');
require('dotenv').config();


const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


const storage = multer.memoryStorage();
const upload = multer({ storage });


const ALLOW_TERMS = [
  'relocat', 'moving', 'move', 'neighborhood', 'neighbourhood', 'area', 'district',
  'explore', 'exploring', 'local', 'nearby', 'around me', 'close by',
  'weather', 'safety', 'crime', 'safe', 'schools', 'education',
  'commute', 'transport', 'public transit', 'bus', 'train', 'subway', 'parking',
  'rent', 'rental', 'apartment', 'housing', 'cost of living',
  'parks', 'places', 'restaurants', 'cafes', 'coffee', 'groceries',
  'gyms', 'hospitals', 'clinics', 'pharmacy',
  'zip code', 'zipcode', 'postal code', 'city', 'town', 'suburb', 'downtown', 'uptown'
];

const isOnTopic = (s = '') => ALLOW_TERMS.some(t => String(s).toLowerCase().includes(t));


const RELOCATION_QUESTIONS = [
  { key: 'destinationCity',   q: 'Which city are you moving to?' },
  { key: 'partySize',         q: 'How many people are relocating (adults/kids)?' },
  { key: 'monthlyBudget',     q: 'What is your approximate monthly housing budget (USD)?' },
  { key: 'commutePrefs',      q: 'What’s your ideal commute (minutes) and mode (car/public transit/walk)?' },
  { key: 'safetyPriority',    q: 'How important is safety on a scale of 1–5 (and any specific concerns)?' },
  { key: 'lifestyleInterests',q: 'Any lifestyle interests to prioritize? (e.g., quiet, nightlife, parks, cafes, schools)' }
];

function ensureRelocationSession(sessionId) {
  if (!SESSIONS.has(sessionId)) {
    SESSIONS.set(sessionId, {
      mode: 'relocation',
      step: 0,
      answers: {},
      startedAt: Date.now()
    });
  }
  return SESSIONS.get(sessionId);
}

function endSession(sessionId) {
  const s = SESSIONS.get(sessionId);
  if (s) s.mode = 'free';
}


router.post('/generate', async (req, res) => {
  try {
    const { prompt = '', sessionId = 'default', relocationMode = false, reset = false } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Reset a session if requested
    if (reset) {
      SESSIONS.delete(sessionId);
      return res.json({ reply: 'Relocation session reset. Say “I want to relocate to <city>” to begin.' });
    }

    // Heuristics to auto-enter relocation mode (only when the client hasn't explicitly set one)
    const looksLikeRelocation = /(relocat|move|moving|new city)/i.test(prompt);
    const clientSpecified = Object.prototype.hasOwnProperty.call(req.body, 'relocationMode');
    const shouldUseRelocation = relocationMode || (!clientSpecified && looksLikeRelocation);

    
    if (shouldUseRelocation) {
      const sess = ensureRelocationSession(sessionId);

      // If this isn't the first step, treat current prompt as the answer to the previous question
      if (sess.step > 0 && sess.step <= RELOCATION_QUESTIONS.length) {
        const prevKey = RELOCATION_QUESTIONS[sess.step - 1].key;
        sess.answers[prevKey] = String(prompt).trim();
      }

      // Ask next question if we still have any
      if (sess.step < RELOCATION_QUESTIONS.length) {
        const nextQ = RELOCATION_QUESTIONS[sess.step].q;
        sess.step += 1;
        return res.json({ reply: nextQ, meta: { mode: 'relocation', step: sess.step } });
      }

      // All questions answered — produce a concise personalized plan
      const a = sess.answers;

      const sys = `
You are LocalGenie, a relocation and local-exploration assistant.
Produce a short, structured plan for the user's move using the details provided.
Tone: friendly, clear, practical. Keep it scannable with short bullets.
Sections to include (only if relevant): Neighborhood Matches, Budget & Housing, Commute, Safety, Schools (if kids), Essentials & Next Steps.
Limit overall response to about 200–250 words.
      `.trim();

      const user = `
User relocation details:
- Destination city: ${a.destinationCity || 'n/a'}
- Party size: ${a.partySize || 'n/a'}
- Monthly housing budget: ${a.monthlyBudget || 'n/a'}
- Commute preferences: ${a.commutePrefs || 'n/a'}
- Safety priority: ${a.safetyPriority || 'n/a'}
- Lifestyle interests: ${a.lifestyleInterests || 'n/a'}

Generate the personalized relocation summary now.
      `.trim();

      const gpt = await openai.chat.completions.create({
        model: 'gpt-4',
        temperature: 0.4,
        max_tokens: 450,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user }
        ]
      });

      const finalText =
        gpt.choices?.[0]?.message?.content?.trim() ||
        'Here is your personalized relocation plan.';

      endSession(sessionId); // park/finish the session (you can keep it if you want follow-ups)

      return res.json({ reply: finalText, meta: { mode: 'relocation', done: true } });
    }

    
    if (!isOnTopic(prompt)) {
      return res.json({
        reply:
          "I’m focused on relocation and local exploration. Try asking about neighborhoods, safety, weather, schools, commutes, housing or places to visit.",
        meta: { mode: 'free' }
      });
    }

    // Short, useful answer (non-guided)
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      temperature: 0.4,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content:
            "You are LocalGenie. Keep answers short and useful. Only cover moving, neighborhoods, local amenities, safety, weather, schools, commutes, housing, and things to do. If off-topic, decline briefly."
        },
        { role: 'user', content: prompt }
      ]
    });

    const aiReply =
      response.choices?.[0]?.message?.content?.trim() ||
      "I’m focused on relocation and local exploration.";
    return res.json({ reply: aiReply, meta: { mode: 'free' } });

  } catch (err) {
    console.error('OpenAI Error:', err?.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to get response from OpenAI' });
  }
});


async function handleTranscription(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Audio file is required' });

  try {
    const buffer = req.file.buffer;
    const tempPath = path.join(__dirname, '../temp', `audio-${Date.now()}.webm`);
    fs.mkdirSync(path.dirname(tempPath), { recursive: true });
    fs.writeFileSync(tempPath, buffer);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      response_format: 'json',
    });

    fs.unlinkSync(tempPath);
    res.json({ text: transcription.text });
  } catch (err) {
    console.error('Whisper Error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
}

router.post('/whisper', upload.single('audio'), handleTranscription);
router.post('/whisper/transcribe', upload.single('audio'), handleTranscription);

module.exports = router;
*/



/*
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { OpenAI } = require('openai');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ---------- OpenAI ----------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------- Multer (for Whisper) ----------
const storage = multer.memoryStorage();
const upload = multer({ storage });


const SESSIONS = new Map();

// ---------- Allowlist guard for free chat (non-relocation) ----------
const ALLOW_TERMS = [
  'relocat', 'moving', 'move', 'neighborhood', 'neighbourhood', 'area', 'district',
  'explore', 'exploring', 'local', 'nearby', 'around me', 'close by',
  'weather', 'safety', 'crime', 'safe', 'schools', 'education',
  'commute', 'transport', 'public transit', 'bus', 'train', 'subway', 'parking',
  'rent', 'rental', 'apartment', 'housing', 'cost of living',
  'parks', 'places', 'restaurants', 'cafes', 'coffee', 'groceries',
  'gyms', 'hospitals', 'clinics', 'pharmacy',
  'zip code', 'zipcode', 'postal code', 'city', 'town', 'suburb', 'downtown', 'uptown'
];

const isOnTopic = (s = '') => ALLOW_TERMS.some(t => String(s).toLowerCase().includes(t));

// ---------- Guided Relocation Flow ----------

const RELOCATION_QUESTIONS = [
  { key: 'destinationCity',   q: 'Which city are you moving to?' },
  { key: 'partySize',         q: 'How many people are relocating (adults/kids)?' },
  { key: 'monthlyBudget',     q: 'What is your approximate monthly housing budget (USD)?' },
  { key: 'commutePrefs',      q: 'What’s your ideal commute (minutes) and mode (car/public transit/walk)?' },
  { key: 'safetyPriority',    q: 'How important is safety on a scale of 1–5 (and any specific concerns)?' },
  { key: 'lifestyleInterests',q: 'Any lifestyle interests to prioritize? (e.g., quiet, nightlife, parks, cafes, schools)' }
];


function ensureRelocationSession(sessionId) {
  if (!SESSIONS.has(sessionId)) {
    SESSIONS.set(sessionId, {
      mode: 'relocation',
      step: 0,
      answers: {},
      startedAt: Date.now()
    });
  }
  return SESSIONS.get(sessionId);
}


function endSession(sessionId) {
  const s = SESSIONS.get(sessionId);
  if (s) s.mode = 'free';
}


router.post('/generate', async (req, res) => {
  try {
    const { prompt = '', sessionId = 'default', relocationMode = false, reset = false } = req.body;

    // reset flow if asked
    if (reset) {
      SESSIONS.delete(sessionId);
      return res.json({ reply: 'Relocation session reset. Say “I want to relocate to <city>” to begin.' });
    }

    // heuristics to auto-enter relocation mode
    const looksLikeRelocation = /(relocat|move|moving|new city)/i.test(prompt);

    // If relocation mode is toggled ON (from UI) OR the text looks like relocation, use the guided flow
    if (relocationMode || looksLikeRelocation) {
      const sess = ensureRelocationSession(sessionId);

      // If we have an unanswered question from a previous step, treat current prompt as the answer
      if (sess.step > 0 && sess.step <= RELOCATION_QUESTIONS.length) {
        const prevKey = RELOCATION_QUESTIONS[sess.step - 1].key;
        sess.answers[prevKey] = String(prompt).trim();
      }

      // If we still have questions to ask, ask the next one
      if (sess.step < RELOCATION_QUESTIONS.length) {
        const nextQ = RELOCATION_QUESTIONS[sess.step].q;
        sess.step += 1;
        return res.json({ reply: nextQ, meta: { mode: 'relocation', step: sess.step } });
      }

      // All questions answered → build a final, concise relocation guide with GPT
      const a = sess.answers;

      const sys = `
You are LocalGenie, a relocation and local-exploration assistant.
Produce a short, structured plan for the user's move using the details provided.
Tone: friendly, clear, practical. Keep it scannable with short bullets.
Sections to include (only if relevant): Neighborhood Matches, Budget & Housing, Commute, Safety, Schools (if kids), Essentials & Next Steps.
Limit overall response to about 200–250 words.
      `.trim();

      const user = `
User relocation details:
- Destination city: ${a.destinationCity || 'n/a'}
- Party size: ${a.partySize || 'n/a'}
- Monthly housing budget: ${a.monthlyBudget || 'n/a'}
- Commute preferences: ${a.commutePrefs || 'n/a'}
- Safety priority: ${a.safetyPriority || 'n/a'}
- Lifestyle interests: ${a.lifestyleInterests || 'n/a'}

Generate the personalized relocation summary now.
      `.trim();

      const gpt = await openai.chat.completions.create({
        model: 'gpt-4',
        temperature: 0.4,
        max_tokens: 450,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user }
        ]
      });

      const finalText =
        gpt.choices?.[0]?.message?.content?.trim() ||
        'Here is your personalized relocation plan.';

      // end/park session (you could also keep it for follow-ups)
      endSession(sessionId);

      return res.json({ reply: finalText, meta: { mode: 'relocation', done: true } });
    }

    // -------- Free chat guard (non-relocation) --------
    if (!isOnTopic(prompt)) {
      return res.json({
        reply:
          "I’m focused on relocation and local exploration. Try asking about neighborhoods, safety, weather, schools, commutes, housing or places to visit.",
        meta: { mode: 'free' }
      });
    }

    // If still on-topic but not in relocation mode, let GPT answer briefly
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      temperature: 0.4,
      max_tokens: 300,
      messages: [
        {
          role: 'system',
          content:
            "You are LocalGenie. Keep answers short and useful. Only cover moving, neighborhoods, local amenities, safety, weather, schools, commutes, housing, and things to do. If off-topic, decline briefly."
        },
        { role: 'user', content: prompt }
      ]
    });

    const aiReply =
      response.choices?.[0]?.message?.content?.trim() ||
      "I’m focused on relocation and local exploration.";
    return res.json({ reply: aiReply, meta: { mode: 'free' } });

  } catch (err) {
    console.error('OpenAI Error:', err?.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to get response from OpenAI' });
  }
});

// ---------- Whisper: POST /api/whisper & /api/whisper/transcribe ----------
async function handleTranscription(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Audio file is required' });

  try {
    const buffer = req.file.buffer;
    const tempPath = path.join(__dirname, '../temp', `audio-${Date.now()}.webm`);
    fs.mkdirSync(path.dirname(tempPath), { recursive: true });
    fs.writeFileSync(tempPath, buffer);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      response_format: 'json',
    });

    fs.unlinkSync(tempPath);
    res.json({ text: transcription.text });
  } catch (err) {
    console.error('Whisper Error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
}

router.post('/whisper', upload.single('audio'), handleTranscription);
router.post('/whisper/transcribe', upload.single('audio'), handleTranscription);

module.exports = router;
*/





/*
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { OpenAI } = require('openai');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ✅ Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ Configure multer for audio uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ------------------------------
// 🔒 On-topic allowlist (MVP)
// ------------------------------
const ALLOW_TERMS = [
  // core intents
  'relocat', 'moving', 'move', 'neighborhood', 'neighbourhood', 'area', 'district',
  'explore', 'exploring', 'local', 'nearby', 'around me', 'close by',

  // categories you support
  'weather', 'safety', 'crime', 'safe', 'schools', 'education',
  'commute', 'transport', 'public transit', 'bus', 'train', 'subway', 'parking',
  'rent', 'rental', 'apartment', 'housing', 'cost of living',
  'parks', 'places', 'restaurants', 'cafes', 'coffee', 'groceries',
  'gyms', 'hospitals', 'clinics', 'pharmacy',
  'zip code', 'zipcode', 'postal code',
  'city', 'town', 'suburb', 'downtown', 'uptown'
];

function isOnTopic(input = '') {
  const q = String(input).toLowerCase();
  return ALLOW_TERMS.some(term => q.includes(term));
}

// --------------------------------------
// 🧪 TEMP: Hard-coded user preferences
// (replace with DB/user profile later)
// --------------------------------------
const userPreferences = {
  preferredCity: 'Los Angeles',
  budgetRange: '$1500–$2500 per month',
  climatePreference: 'Warm & sunny',
  interests: ['beaches', 'coffee shops', 'live music'],
  safetyImportance: 'High',                // High / Medium / Low
  commuteToleranceMins: 35,               // max acceptable one-way commute
};

// Build a short, single-line preferences context
const prefsContext = `
User preferences for personalization:
- Preferred city: ${userPreferences.preferredCity}
- Budget: ${userPreferences.budgetRange}
- Climate: ${userPreferences.climatePreference}
- Interests: ${userPreferences.interests.join(', ')}
- Safety importance: ${userPreferences.safetyImportance}
- Max commute (one-way): ${userPreferences.commuteToleranceMins} mins
`.trim();

// ---------------------------------------------
// ✅ POST /api/generate (text → GPT response)
// ---------------------------------------------
router.post('/generate', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // 🛑 Pre-filter off-topic to save tokens
  if (!isOnTopic(prompt)) {
    return res.json({
      reply:
        "I’m focused on relocation and local exploration. " +
        "Try asking about neighborhoods, safety, weather, schools, commutes, housing, or places to visit."
    });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      temperature: 0.4,
      max_tokens: 450,
      messages: [
        {
          role: 'system',
          content:
            "You are LocalGenie, a relocation and local-exploration assistant. " +
            "You ONLY answer questions related to moving, neighborhoods, local amenities, safety, weather, schools, commutes, housing, and things to do. " +
            "If the user asks for unrelated topics, politely decline in one sentence and suggest relevant topics you CAN help with. " +
            "Use concise language, practical tips, and short bullets where helpful.\n\n" +
            prefsContext
        },
        { role: 'user', content: prompt }
      ]
    });

    const aiReply =
      response.choices?.[0]?.message?.content?.trim() ||
      "I’m focused on relocation and local exploration. Ask about neighborhoods, safety, schools, commutes, housing, weather, or places to visit.";

    res.json({ reply: aiReply });
  } catch (err) {
    console.error('OpenAI Error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to get response from OpenAI' });
  }
});

// ---------------------------------------------------
// ✅ POST /api/whisper  (audio → text transcription)
//     + alias: /api/whisper/transcribe
// ---------------------------------------------------
async function handleTranscription(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'Audio file is required' });
  }

  try {
    const buffer = req.file.buffer;
    const tempPath = path.join(__dirname, '../temp', `audio-${Date.now()}.webm`);

    // Ensure temp directory exists
    fs.mkdirSync(path.dirname(tempPath), { recursive: true });

    // Save buffer to temp file
    fs.writeFileSync(tempPath, buffer);

    // Use OpenAI Whisper API for transcription
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      response_format: 'json',
    });

    // Clean up temp file
    fs.unlinkSync(tempPath);

    res.json({ text: transcription.text });
  } catch (err) {
    console.error('Whisper Error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
}

router.post('/whisper', upload.single('audio'), handleTranscription);
// alias to match frontend that might call /api/whisper/transcribe
router.post('/whisper/transcribe', upload.single('audio'), handleTranscription);

module.exports = router;
*/



/*
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { OpenAI } = require('openai');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ✅ Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ Configure multer for audio uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ------------------------------
// 🔒 On-topic allowlist (MVP)
// ------------------------------
const ALLOW_TERMS = [
  // core intents
  'relocat', 'moving', 'move', 'neighborhood', 'neighbourhood', 'area', 'district',
  'explore', 'exploring', 'local', 'nearby', 'around me', 'close by',

  // categories you support
  'weather', 'safety', 'crime', 'safe', 'schools', 'education',
  'commute', 'transport', 'public transit', 'bus', 'train', 'subway', 'parking',
  'rent', 'rental', 'apartment', 'housing', 'cost of living',
  'parks', 'places', 'restaurants', 'cafes', 'coffee', 'groceries',
  'gyms', 'hospitals', 'clinics', 'pharmacy',
  'zip code', 'zipcode', 'postal code',
  'city', 'town', 'suburb', 'downtown', 'uptown'
];

function isOnTopic(input = '') {
  const q = String(input).toLowerCase();
  return ALLOW_TERMS.some(term => q.includes(term));
}

// ---------------------------------------------
// ✅ POST /api/generate (text → GPT response)
// ---------------------------------------------
router.post('/generate', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // 🛑 Pre-filter off-topic to save tokens
  if (!isOnTopic(prompt)) {
    return res.json({
      reply:
        "I’m focused on relocation and local exploration. " +
        "Try asking about neighborhoods, safety, weather, schools, commutes, housing, or places to visit."
    });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      temperature: 0.4,
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content:
            "You are LocalGenie, a relocation and local-exploration assistant. " +
            "You ONLY answer questions related to moving, neighborhoods, local amenities, safety, weather, schools, commutes, housing, and things to do. " +
            "If the user asks for unrelated topics, politely decline in one sentence and suggest relevant topics you CAN help with. " +
            "Be concise, accurate, and practical. Use short bullets where helpful."
        },
        { role: 'user', content: prompt }
      ]
    });

    const aiReply =
      response.choices?.[0]?.message?.content?.trim() ||
      "I’m focused on relocation and local exploration. Ask about neighborhoods, safety, schools, commutes, housing, weather, or places to visit.";

    res.json({ reply: aiReply });
  } catch (err) {
    console.error('OpenAI Error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to get response from OpenAI' });
  }
});

// ---------------------------------------------------
// ✅ POST /api/whisper  (audio → text transcription)
//     + alias: /api/whisper/transcribe
// ---------------------------------------------------
async function handleTranscription(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'Audio file is required' });
  }

  try {
    const buffer = req.file.buffer;
    const tempPath = path.join(__dirname, '../temp', `audio-${Date.now()}.webm`);

    // Ensure temp directory exists
    fs.mkdirSync(path.dirname(tempPath), { recursive: true });

    // Save buffer to temp file
    fs.writeFileSync(tempPath, buffer);

    // Use OpenAI Whisper API for transcription
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      response_format: 'json',
    });

    // Clean up temp file
    fs.unlinkSync(tempPath);

    res.json({ text: transcription.text });
  } catch (err) {
    console.error('Whisper Error:', err?.response?.data || err.message);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
}

router.post('/whisper', upload.single('audio'), handleTranscription);
// alias to match frontend that might call /api/whisper/transcribe
router.post('/whisper/transcribe', upload.single('audio'), handleTranscription);

module.exports = router;
*/



/*
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { OpenAI } = require('openai');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ✅ Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ Configure multer for audio uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ✅ POST /api/generate (text → GPT response)
router.post('/generate', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
    });

    const aiReply = response.choices[0].message.content.trim();
    res.json({ reply: aiReply });
  } catch (err) {
    console.error('OpenAI Error:', err.message);
    res.status(500).json({ error: 'Failed to get response from OpenAI' });
  }
});

// ✅ POST /api/whisper (audio → text transcription)
router.post('/whisper', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Audio file is required' });
  }

  try {
    const buffer = req.file.buffer;
    const tempPath = path.join(__dirname, '../temp', `audio-${Date.now()}.webm`);

    // Ensure temp directory exists
    fs.mkdirSync(path.dirname(tempPath), { recursive: true });

    // Save buffer to temp file
    fs.writeFileSync(tempPath, buffer);

    // Use OpenAI Whisper API for transcription
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      response_format: 'json',
    });

    // Clean up temp file
    fs.unlinkSync(tempPath);

    res.json({ text: transcription.text });
  } catch (err) {
    console.error('Whisper Error:', err.message);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  }
});

module.exports = router;
*/






/*
const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
require('dotenv').config();

// ✅ Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ POST /api/generate
router.post('/generate', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4', // or "gpt-3.5-turbo"
      messages: [{ role: 'user', content: prompt }],
    });

    const aiReply = response.choices[0].message.content.trim();
    res.json({ reply: aiReply });
  } catch (err) {
    console.error('OpenAI Error:', err.message);
    res.status(500).json({ error: 'Failed to get response from OpenAI' });
  }
});

module.exports = router;
*/




/*
// routes/openaiRoute.js
const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
require('dotenv').config();

// ✅ Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ✅ POST /api/generate
router.post('/generate', async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4", // or "gpt-3.5-turbo"
      messages: [{ role: "user", content: prompt }],
    });

    const aiReply = response.choices[0].message.content.trim();
    res.json({ reply: aiReply });
  } catch (err) {
    console.error('OpenAI Error:', err.message);
    res.status(500).json({ error: 'Failed to get response from OpenAI' });
  }
});

module.exports = router;
*/