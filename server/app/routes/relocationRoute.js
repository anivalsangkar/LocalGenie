// server/app/routes/relocationRoute.js
const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 🧠 Simple in-memory session store (swap to Mongo later if needed)
const SESSIONS = new Map(); // key: sessionId -> { city, step, answers, done }

// The interview steps (order matters)
const QUESTIONNAIRE = [
  { key: 'partySize',     q: 'How many people are relocating (adults/children)?' },
  { key: 'timeframe',     q: 'What is your target move date or timeframe?' },
  { key: 'budget',        q: 'What is your approximate monthly housing budget (USD)?' },
  { key: 'housingType',   q: 'Preferred housing type: apartment, condo, single-family, or flexible?' },
  { key: 'commute',       q: 'Where will you work/study? Any commute limit in minutes?' },
  { key: 'priorities',    q: 'Top 2–3 priorities: safety, schools, nightlife, walkability, access to parks/beach, etc.?' }
];

// Small helper
function startSession(sessionId, city) {
  const s = { city, step: 0, answers: {}, done: false };
  SESSIONS.set(sessionId, s);
  return s;
}

router.post('/relocate', async (req, res) => {
  try {
    const { sessionId, message, city } = req.body;

    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    // Start / reset flow
    let s = SESSIONS.get(sessionId);
    const wantsStart = /^(start|restart|relocate|i want to relocate)/i.test(message || '') || !s;

    if (wantsStart) {
      if (!city && !(s && s.city)) {
        // ask for city first
        const existing = s || startSession(sessionId, null);
        existing.city = null;
        existing.step = -1; // city step
        existing.done = false;
        return res.json({ reply: "Great—where are you planning to relocate? (city name)", awaiting: "city" });
      }
      // init with known/provided city
      s = startSession(sessionId, city || (s && s.city));
      return res.json({ reply: `Awesome—relocating to ${s.city}. ${QUESTIONNAIRE[0].q}`, step: 0 });
    }

    // existing session continues
    if (!s) {
      return res.json({ reply: "Say 'relocate' to begin a short questionnaire and I’ll personalize recommendations." });
    }

    // If we were waiting for city
    if (s.step === -1) {
      const cityGuess = String(message || '').trim();
      if (!cityGuess) return res.json({ reply: "Please provide a city to continue." });
      s.city = cityGuess;
      s.step = 0;
      return res.json({ reply: `Got it: ${s.city}. ${QUESTIONNAIRE[0].q}`, step: 0 });
    }

    // If we already finished, let them restart or ask follow-ups
    if (s.done) {
      if (/^restart/i.test(message || '')) {
        s = startSession(sessionId, s.city);
        return res.json({ reply: `Restarting for ${s.city}. ${QUESTIONNAIRE[0].q}`, step: 0 });
      }
      return res.json({ reply: "We’re done! Say 'restart' to run the questionnaire again, or ask for more detail." });
    }

    // Record answer for the current step
    const current = QUESTIONNAIRE[s.step];
    if (current) s.answers[current.key] = String(message || '').trim();

    // Advance step or finalize
    s.step += 1;
    if (s.step < QUESTIONNAIRE.length) {
      const next = QUESTIONNAIRE[s.step];
      return res.json({ reply: next.q, step: s.step });
    }

    // Finalize → call GPT to summarize
    s.done = true;

    const prompt =
      `You are LocalGenie. Produce a concise relocation recommendation for ${s.city}.\n` +
      `Use the answers below. Provide: Summary (2 sentences), Top neighborhoods (3 bullets, 1 reason each), ` +
      `Budget/safety/commute notes (3–4 bullets), and Next steps (2 bullets). Be specific and practical.\n\n` +
      `Answers:\n` +
      Object.entries(s.answers).map(([k, v]) => `- ${k}: ${v}`).join('\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      temperature: 0.35,
      max_tokens: 500,
      messages: [
        { role: 'system', content: "You are a precise relocation assistant. No fluff, just helpful detail." },
        { role: 'user', content: prompt }
      ]
    });

    const recommendation = response.choices?.[0]?.message?.content?.trim()
      || `Here’s a summary for relocating to ${s.city}.`;

    return res.json({
      reply: `Thanks! Here’s your tailored plan for ${s.city}:\n\n${recommendation}`,
      done: true
    });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;
