// server/app/routes/relocationRoute.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const { OpenAI } = require("openai");

require("dotenv").config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || "";

/* --------------------------- tiny cache --------------------------- */
// Cache Unsplash results briefly so repeated regenerations don’t hammer the API
// Key: `${baseQuery}`  ->  { url, photoId, ts }
const CACHE = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheGet(key) {
  const hit = CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > CACHE_TTL_MS) {
    CACHE.delete(key);
    return null;
  }
  return hit;
}
function cacheSet(key, val) {
  CACHE.set(key, { ...val, ts: Date.now() });
}

/* --------------------------- helpers --------------------------- */
function pickJSON(str) {
  if (!str) return null;
  const m = str.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = m ? m[1] : str;
  try { return JSON.parse(raw); } catch { return null; }
}

function toId(s, i = 0) {
  return String(s || `item-${i}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fallbackMaps(neighborhood, city) {
  const q = encodeURIComponent(`${neighborhood}, ${city}`);
  return `https://www.google.com/maps/search/${q}`;
}

// Deterministic Unsplash Source fallback (works without API key). `sig` makes it unique.
const sourceUnsplash = (q, sig) =>
  `https://source.unsplash.com/800x600/?${encodeURIComponent(q)}&sig=${encodeURIComponent(sig)}`;

/**
 * Fetch a *unique* Unsplash image for a query.
 * - Dedupe by **photo ID** (not URL) to avoid same photo via different sizes/URLs
 * - Tries multiple phrases and 2 pages
 * - Uses a tiny TTL cache to limit API calls
 * - Returns { url, photoId } or { url: "", photoId: "" }
 */
async function fetchUnsplashUniqueById(baseQuery, usedPhotoIds) {
  // Cache first
  const cached = cacheGet(baseQuery);
  if (cached && !usedPhotoIds.has(cached.photoId)) {
    usedPhotoIds.add(cached.photoId);
    return cached;
  }

  if (!UNSPLASH_ACCESS_KEY) return { url: "", photoId: "" };

  const client = axios.create({
    baseURL: "https://api.unsplash.com",
    headers: {
      Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
      "Accept-Version": "v1",
      "User-Agent": "LocalGenie/relocation (unsplash-fetch)",
    },
    timeout: 8000,
  });

  const phrases = [
    baseQuery,
    `${baseQuery} skyline`,
    `${baseQuery} neighborhood`,
    `${baseQuery} landmark`,
    `${baseQuery} street`,
    `${baseQuery} cityscape`,
    `${baseQuery} sunset`,
  ];

  const pages = [1, 2];

  for (const q of phrases) {
    for (const page of pages) {
      try {
        const { data } = await client.get("/search/photos", {
          params: {
            query: q,
            per_page: 12,
            page,
            orientation: "landscape",
            content_filter: "high",
          },
        });

        const results = Array.isArray(data?.results) ? data.results : [];

        for (const p of results) {
          const photoId = String(p?.id || "");
          const url =
            p?.urls?.regular || p?.urls?.full || p?.urls?.small || "";

          if (photoId && url && !usedPhotoIds.has(photoId)) {
            usedPhotoIds.add(photoId);
            cacheSet(baseQuery, { url, photoId }); // memoize best hit for this query
            return { url, photoId };
          }
        }
      } catch {
        // continue to next phrase/page
      }
    }
  }
  return { url: "", photoId: "" };
}

/* --------------------------- routes --------------------------- */
router.get("/ping", (_req, res) => res.json({ ok: true }));

router.post("/recommend", async (req, res) => {
  try {
    const {
      destination = "",
      familySize = "",
      accommodation = "",
      initialQuery = "",
    } = req.body || {};

    const city = String(destination).trim();
    if (!city) return res.json({ items: [], meta: { destination: "" } });

    const system = [
      "You are LocalGenie, a precise relocation assistant.",
      "Return ONLY valid JSON with this exact shape:",
      `{
        "items": [{
          "id": "string-kebab",
          "title": "Neighborhood name",
          "rating": 4.6,
          "reviews": "6.2k",
          "subtitle": "One short reason the user would like it",
          "image": "",
          "ctaUrl": "https://www.google.com/maps/search/Neighborhood,+City",
          "tags": ["family-friendly","walkable"]
        }]
      }`,
      "Rules:",
      "- Provide 4–6 distinct neighborhoods in/around the city.",
      "- You may leave image empty; the server will fetch one.",
      "- Use a Google Maps search URL for ctaUrl.",
      "- No prose, no markdown, JSON only."
    ].join("\n");

    const user = [
      `City: ${city}`,
      familySize ? `Family size: ${familySize}` : "",
      accommodation ? `Accommodation: ${accommodation}` : "",
      initialQuery ? `User query: ${initialQuery}` : "",
      "",
      "Include a mix of vibes (family-friendly, walkable, beachy, quiet suburb, artsy, nightlife).",
      "Ratings realistic (4.1–4.9). Keep subtitles concise."
    ].join("\n");

    const oa = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const raw = oa?.choices?.[0]?.message?.content?.trim() || "";
    let parsed = pickJSON(raw);
    if (!parsed || !Array.isArray(parsed.items)) parsed = { items: [] };

    // Always use Unsplash and ensure uniqueness by **photo ID**
    const usedPhotoIds = new Set();

    const items = [];
    const slice = parsed.items.slice(0, 6);

    for (let i = 0; i < slice.length; i++) {
      const it = slice[i] || {};
      const title = String(it.title || "Neighborhood").trim();
      const id = toId(it.id || title, i);

      // 1) Try Unsplash API — unique by photo ID
      const baseQuery = `${title} ${city}`;
      let { url: imageUrl } = await fetchUnsplashUniqueById(baseQuery, usedPhotoIds);

      // 2) Fallback: Unsplash Source with unique `sig` (different image per card)
      if (!imageUrl) {
        imageUrl = sourceUnsplash(`${baseQuery} streetscape`, `${city}-${title}-${id}`);
      }

      // Maps link
      let ctaUrl = typeof it.ctaUrl === "string" ? it.ctaUrl.trim() : "";
      if (!/^https?:\/\//i.test(ctaUrl)) {
        ctaUrl = fallbackMaps(title, city);
      }

      // Rating sanity
      let rating = Number(it.rating || 0);
      if (!Number.isFinite(rating) || rating < 3.5 || rating > 5) rating = 4.6;

      items.push({
        id,
        title,
        rating,
        reviews: String(it.reviews || ""),
        subtitle: String(it.subtitle || ""),
        image: imageUrl,
        ctaUrl,
        tags: Array.isArray(it.tags) ? it.tags.slice(0, 5).map(String) : [],
      });
    }

    return res.json({
      items,
      meta: { destination: city, familySize, accommodation, initialQuery },
    });
  } catch (err) {
    console.error("recommend error:", err);
    return res.status(500).json({ items: [], error: "failed_to_generate" });
  }
});

module.exports = router;



/*
// server/app/routes/relocationRoute.js
const express = require("express");
const router = express.Router();
const axios = require("axios");
const { OpenAI } = require("openai");

require("dotenv").config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || "";


function pickJSON(str) {
  if (!str) return null;
  const m = str.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = m ? m[1] : str;
  try { return JSON.parse(raw); } catch { return null; }
}

function toId(s, i = 0) {
  return String(s || `item-${i}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fallbackMaps(neighborhood, city) {
  const q = encodeURIComponent(`${neighborhood}, ${city}`);
  return `https://www.google.com/maps/search/${q}`;
}

// Deterministic Unsplash Source fallback (works without API key). `sig` makes it unique.
const sourceUnsplash = (q, sig) =>
  `https://source.unsplash.com/800x600/?${encodeURIComponent(q)}&sig=${encodeURIComponent(sig)}`;


async function fetchUnsplashUniqueById(baseQuery, usedPhotoIds) {
  if (!UNSPLASH_ACCESS_KEY) return { url: "", photoId: "" };

  const phrases = [
    baseQuery,
    `${baseQuery} skyline`,
    `${baseQuery} neighborhood`,
    `${baseQuery} landmark`,
    `${baseQuery} street`,
    `${baseQuery} cityscape`,
    `${baseQuery} sunset`,
  ];
  const pages = [1, 2];

  for (const q of phrases) {
    for (const page of pages) {
      try {
        const { data } = await axios.get("https://api.unsplash.com/search/photos", {
          params: {
            query: q,
            per_page: 10,
            page,
            orientation: "landscape",
            content_filter: "high",
          },
          headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` },
          timeout: 8000,
        });

        const results = Array.isArray(data?.results) ? data.results : [];

        for (const p of results) {
          const photoId = String(p?.id || "");
          const url =
            p?.urls?.regular || p?.urls?.full || p?.urls?.small || "";

          if (photoId && url && !usedPhotoIds.has(photoId)) {
            usedPhotoIds.add(photoId);
            return { url, photoId };
          }
        }
      } catch {
        // try next phrase/page
      }
    }
  }
  return { url: "", photoId: "" };
}


router.get("/ping", (_req, res) => res.json({ ok: true }));

router.post("/recommend", async (req, res) => {
  try {
    const {
      destination = "",
      familySize = "",
      accommodation = "",
      initialQuery = "",
    } = req.body || {};

    const city = String(destination).trim();
    if (!city) return res.json({ items: [], meta: { destination: "" } });

    const system = [
      "You are LocalGenie, a precise relocation assistant.",
      "Return ONLY valid JSON with this exact shape:",
      `{
        "items": [{
          "id": "string-kebab",
          "title": "Neighborhood name",
          "rating": 4.6,
          "reviews": "6.2k",
          "subtitle": "One short reason the user would like it",
          "image": "",
          "ctaUrl": "https://www.google.com/maps/search/Neighborhood,+City",
          "tags": ["family-friendly","walkable"]
        }]
      }`,
      "Rules:",
      "- Provide 4–6 distinct neighborhoods in/around the city.",
      "- You may leave image empty; the server will fetch one.",
      "- Use a Google Maps search URL for ctaUrl.",
      "- No prose, no markdown, JSON only."
    ].join("\n");

    const user = [
      `City: ${city}`,
      familySize ? `Family size: ${familySize}` : "",
      accommodation ? `Accommodation: ${accommodation}` : "",
      initialQuery ? `User query: ${initialQuery}` : "",
      "",
      "Include a mix of vibes (family-friendly, walkable, beachy, quiet suburb, artsy, nightlife).",
      "Ratings realistic (4.1–4.9). Keep subtitles concise."
    ].join("\n");

    const oa = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });

    const raw = oa?.choices?.[0]?.message?.content?.trim() || "";
    let parsed = pickJSON(raw);
    if (!parsed || !Array.isArray(parsed.items)) parsed = { items: [] };

    // Always use Unsplash and ensure uniqueness by **photo ID**
    const usedPhotoIds = new Set();

    const items = [];
    const slice = parsed.items.slice(0, 6);

    for (let i = 0; i < slice.length; i++) {
      const it = slice[i] || {};
      const title = String(it.title || "Neighborhood").trim();
      const id = toId(it.id || title, i);

      // 1) Try Unsplash API — unique by photo ID
      const baseQuery = `${title} ${city}`;
      let { url: imageUrl } = await fetchUnsplashUniqueById(baseQuery, usedPhotoIds);

      // 2) Fallback: Unsplash Source with unique `sig` (ensures different images per card)
      if (!imageUrl) {
        imageUrl = sourceUnsplash(`${baseQuery} streetscape`, `${city}-${title}-${id}`);
      }

      // Maps link
      let ctaUrl = typeof it.ctaUrl === "string" ? it.ctaUrl.trim() : "";
      if (!/^https?:\/\//i.test(ctaUrl)) {
        ctaUrl = fallbackMaps(title, city);
      }

      // Rating sanity
      let rating = Number(it.rating || 0);
      if (!Number.isFinite(rating) || rating < 3.5 || rating > 5) rating = 4.6;

      items.push({
        id,
        title,
        rating,
        reviews: String(it.reviews || ""),
        subtitle: String(it.subtitle || ""),
        image: imageUrl,
        ctaUrl,
        tags: Array.isArray(it.tags) ? it.tags.slice(0, 5).map(String) : [],
      });
    }

    return res.json({
      items,
      meta: { destination: city, familySize, accommodation, initialQuery },
    });
  } catch (err) {
    console.error("recommend error:", err);
    return res.status(500).json({ items: [], error: "failed_to_generate" });
  }
});

module.exports = router;
*/




/*
// server/app/routes/relocationRoute.js
const express = require("express");
const router = express.Router();

const { OpenAI } = require("openai");
require("dotenv").config(); // safe even if called elsewhere

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Pull JSON out of ```json ... ``` if the model wraps it
function pickJSON(str) {
  if (!str) return null;
  const m = str.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = m ? m[1] : str;
  try { return JSON.parse(raw); } catch { return null; }
}

function toId(s, i = 0) {
  return String(s || `item-${i}`).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function fallbackImage(neighborhood, city) {
  // Reliable on-the-fly image from Unsplash Source API
  const q = encodeURIComponent(`${neighborhood} ${city} streetscape`);
  return `https://source.unsplash.com/600x400/?${q}`;
}

function fallbackMaps(neighborhood, city) {
  const q = encodeURIComponent(`${neighborhood}, ${city}`);
  return `https://www.google.com/maps/search/${q}`;
}

// ----- quick ping -----
router.get("/ping", (_req, res) => res.json({ ok: true }));

// ===== POST /api/relocation/recommend =====
router.post("/recommend", async (req, res) => {
  try {
    const {
      destination = "",
      familySize = "",
      accommodation = "",
      initialQuery = ""
    } = req.body || {};

    const city = String(destination).trim();
    if (!city) return res.json({ items: [], meta: { destination: "" } });

    // ---- Strong prompt: require direct image URLs ----
    const system = [
      "You are LocalGenie, a precise relocation assistant.",
      "Return ONLY valid JSON with this shape:",
      `{
        "items": [{
          "id": "string-kebab",
          "title": "Neighborhood name",
          "rating": 4.6,
          "reviews": "6.2k",
          "subtitle": "One short reason the user would like it",
          "image": "https://... (public, direct, stable image URL)",
          "ctaUrl": "https://www.google.com/maps/search/Neighborhood,+City",
          "tags": ["family-friendly","walkable"]
        }]
      }`,
      "Rules:",
      "- Provide 4–6 distinct neighborhoods in/around the city.",
      "- For `image`, prefer reliable public sources: Unsplash (images.unsplash.com/*), Wikimedia (upload.wikimedia.org/*), or Pexels (images.pexels.com/*).",
      "- Do NOT return data URIs, tracking/JS links, or empty strings.",
      "- For `ctaUrl`, use a Google Maps search URL for that neighborhood and the city.",
      "- No prose, no markdown, no code fences—JSON only."
    ].join("\n");

    const user = [
      `City: ${city}`,
      familySize ? `Family size: ${familySize}` : "",
      accommodation ? `Accommodation: ${accommodation}` : "",
      initialQuery ? `User query: ${initialQuery}` : "",
      "",
      "Include a mix of vibes (family-friendly, walkable, beachy, quiet suburb, artsy, nightlife).",
      "Ratings realistic (4.1–4.9). Keep subtitles concise."
    ].join("\n");

    const oa = await openai.chat.completions.create({
      model: "gpt-4o-mini", // use "gpt-4o" if you want the bigger model
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    });

    const raw = oa?.choices?.[0]?.message?.content?.trim() || "";
    let parsed = pickJSON(raw);
    if (!parsed || !Array.isArray(parsed.items)) parsed = { items: [] };

    // ---- sanitize + guaranteed fallbacks ----
    const items = parsed.items.slice(0, 6).map((it, i) => {
      const title = String(it.title || "Neighborhood").trim();
      const id = toId(it.id || title, i);

      // Validate image host; fallback if missing/suspicious
      let image = typeof it.image === "string" ? it.image.trim() : "";
      const okHost = /^(https?:)\/\/(images\.unsplash\.com|upload\.wikimedia\.org|images\.pexels\.com|source\.unsplash\.com)\//i;
      if (!okHost.test(image)) {
        image = fallbackImage(title, city);
      }

      // Ensure ctaUrl
      let ctaUrl = typeof it.ctaUrl === "string" ? it.ctaUrl.trim() : "";
      if (!/^https?:\/\//i.test(ctaUrl)) {
        ctaUrl = fallbackMaps(title, city);
      }

      // Clamp rating
      let rating = Number(it.rating || 0);
      if (!Number.isFinite(rating) || rating < 3.5 || rating > 5) rating = 4.6;

      return {
        id,
        title,
        rating,
        reviews: String(it.reviews || ""),
        subtitle: String(it.subtitle || ""),
        image,
        ctaUrl,
        tags: Array.isArray(it.tags) ? it.tags.slice(0, 5).map(String) : []
      };
    });

    return res.json({
      items,
      meta: { destination: city, familySize, accommodation, initialQuery }
    });
  } catch (err) {
    console.error("recommend error:", err);
    return res.status(500).json({ items: [], error: "failed_to_generate" });
  }
});

module.exports = router;
*/




/*
// server/app/routes/relocationRoute.js
const express = require("express");
const router = express.Router();

const { OpenAI } = require("openai");
require("dotenv").config(); // loads server/app/.env (safe to call again)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// small helper: extract JSON even if the model wraps it in ```json fences
function pickJSON(str) {
  if (!str) return null;
  const m = str.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = m ? m[1] : str;
  try { return JSON.parse(raw); } catch { return null; }
}

// simple ping for debugging
router.get("/ping", (_req, res) => res.json({ ok: true }));

// === POST /api/relocation/recommend ===
router.post("/recommend", async (req, res) => {
  try {
    const {
      destination = "",
      familySize = "",
      accommodation = "",
      initialQuery = ""
    } = req.body || {};

    const city = String(destination).trim();
    if (!city) return res.json({ items: [], meta: { destination: "" } });

    const system = [
      "You are LocalGenie, a precise relocation assistant.",
      "Return ONLY valid JSON in this exact shape:",
      `{"items":[{"id":"string-kebab","title":"Neighborhood","rating":4.7,"reviews":"6.2k","subtitle":"short reason","image":"","ctaUrl":"https://maps.google.com/?q=Neighborhood, City","tags":["family-friendly","walkable"]}]}`,
      "No prose, no Markdown, no code fences—JSON only."
    ].join("\n");

    const user = [
      `City: ${city}`,
      familySize ? `Family size: ${familySize}` : "",
      accommodation ? `Accommodation: ${accommodation}` : "",
      initialQuery ? `User query: ${initialQuery}` : "",
      "",
      "Suggest 4–6 well-known neighborhoods with diverse vibes.",
      "If unsure about an image URL, leave it empty."
    ].join("\n");

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",      // or "gpt-4o"
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    });

    const raw = resp?.choices?.[0]?.message?.content?.trim() || "";
    let parsed = pickJSON(raw);
    if (!parsed || !Array.isArray(parsed.items)) parsed = { items: [] };

    // sanitize for the UI
    const items = parsed.items.slice(0, 6).map((it, i) => ({
      id: String(it.id || `${city}-${i}`).toLowerCase().replace(/\s+/g, "-"),
      title: String(it.title || "Neighborhood"),
      rating: Number(it.rating || 0),
      reviews: String(it.reviews || ""),
      subtitle: String(it.subtitle || ""),
      image: typeof it.image === "string" ? it.image : "",
      ctaUrl: typeof it.ctaUrl === "string" ? it.ctaUrl : "",
      tags: Array.isArray(it.tags) ? it.tags.slice(0, 5).map(String) : []
    }));

    return res.json({
      items,
      meta: { destination: city, familySize, accommodation, initialQuery }
    });
  } catch (err) {
    console.error("recommend error:", err);
    return res.status(500).json({ items: [], error: "failed_to_generate" });
  }
});

module.exports = router;
*/



/*
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
*/