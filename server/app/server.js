// server.js
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const OpenAI = require('openai');

// 🔐 Load environment variables from .env
dotenv.config();

// ✅ Polyfill fetch if not available (Node <18)
globalThis.fetch ||= ((...args) =>
  import('node-fetch').then(m => m.default(...args))
);

// ✅ Internal modules
const connectDB = require('./config/db');
const User = require('./models/User');
const protectedRoute = require('./routes/protectedRoute');
const userRoutes = require('./routes/userRoutes');
const openaiRoute = require('./routes/openaiRoute');
const whisperRoute = require('./routes/whisperRoute');
const relocationRoute = require('./routes/relocationRoute');

// 🔗 Connect to MongoDB
connectDB();

// ✅ Initialize express app
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // ensure body is parsed before routes

const JWT_SECRET = process.env.JWT_SECRET || 'super$ecretjwt|Token5182';

// ✅ Health checks
app.get('/', (_req, res) => {
  res.send('🚀 API is running and connected to MongoDB Atlas');
});
app.get('/health', (_req, res) => res.json({ ok: true }));

// ✅ Registration route
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    const savedUser = await newUser.save();

    res.status(201).json({
      id: savedUser._id,
      name: savedUser.name,
      email: savedUser.email,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Login route
app.post('/api/login', async (req, res) => {
  const { email, password, location } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    // Update location if provided
    if (location && Array.isArray(location.coordinates) && location.coordinates.length === 2) {
      user.location = location;
      await user.save();
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Feature routes
app.use('/api', protectedRoute);
app.use('/user', userRoutes);
app.use('/api', openaiRoute);
app.use('/api/whisper', whisperRoute);
app.use('/api/relocation', relocationRoute);

/* ------------------------------------------------------------------
   OpenAI client + simple dev cache
------------------------------------------------------------------- */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const areaCache = new Map();

/* ------------------------------------------------------------------
   Area enrichment endpoint (LLM-based, historic/general info)
------------------------------------------------------------------- */
app.post('/api/areas/enrich', async (req, res) => {
  try {
    const { name, city, state, tags = [], budget, familySize } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });

    const cacheKey = `${name}|${city}|${state}|${tags.join(',')}|${budget || ''}|${familySize || ''}`;
    if (areaCache.has(cacheKey)) return res.json(areaCache.get(cacheKey));

    const systemPrompt = [
      'You are a relocation assistant. Generate stable, historically-known neighborhood summaries.',
      'Do NOT browse the web or use live data. If unsure for a field, return "unknown".',
      'Stick to widely-known, pre-2024 general characteristics only.',
      'Return ONLY JSON conforming to the provided schema.'
    ].join(' ');

    const userPayload = { name, city, state, tags, budget, familySize };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Enrich this place with historically-known info (no live lookups): ${JSON.stringify(userPayload)}` }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'AreaDetails',
          schema: {
            type: 'object',
            required: ['title','description','tags','metrics','heroImages'],
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' }, maxItems: 6 },
              heroImages: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 },
              metrics: {
                type: 'object',
                required: ['safety','schools','rent','commute'],
                properties: {
                  safety: {
                    type: 'object',
                    required: ['crime','score'],
                    properties: {
                      crime: { type: 'string', enum: ['Low','Medium','High','unknown'] },
                      score: { type: 'string' }
                    }
                  },
                  schools: {
                    type: 'object',
                    required: ['avg','count'],
                    properties: {
                      avg: { type: 'string' },
                      count: { type: 'string' }
                    }
                  },
                  rent: {
                    type: 'object',
                    required: ['avg'],
                    properties: { avg: { type: 'string' } }
                  },
                  commute: {
                    type: 'object',
                    required: ['downtown','airport'],
                    properties: {
                      downtown: { type: 'string' },
                      airport: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const payload = JSON.parse(completion.choices[0].message.content || '{}');

    if (!payload.heroImages || payload.heroImages.length === 0) {
      payload.heroImages = [
        'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=2000&auto=format&fit=crop'
      ];
    }

    areaCache.set(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    console.error('enrich error:', err?.response?.data || err);
    res.status(500).json({ error: 'openai_error', detail: String(err.message || err) });
  }
});

/* ------------------------------------------------------------------
   POI list endpoint for Explore More
------------------------------------------------------------------- */
app.post('/api/areas/poi', async (req, res) => {
  try {
    const { name, city, state, category = 'Groceries', query = '', limit = 12 } = req.body || {};
    if (!name || !city) return res.status(400).json({ error: 'name and city required' });

    const key = `poi|${name}|${city}|${state}|${category}|${query}|${limit}`;
    if (!areaCache.has(key)) {
      const system = [
        'You list nearby places for a neighborhood using only stable, historically-known info.',
        'NO web browsing or live data. If unsure, provide plausible, generic examples typical for the area (well-known chains or districts).',
        'Return JSON only, conforming to schema. Keep titles succinct; subtitles one short line.'
      ].join(' ');

      const user = { name, city, state, category, query, limit };

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.5,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Return ${limit} items for this category and area: ${JSON.stringify(user)}` }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'POIList',
            schema: {
              type: 'object',
              required: ['items'],
              additionalProperties: false,
              properties: {
                items: {
                  type: 'array',
                  maxItems: limit,
                  items: {
                    type: 'object',
                    required: ['title', 'subtitle', 'rating', 'image'],
                    additionalProperties: false,
                    properties: {
                      title: { type: 'string' },
                      subtitle: { type: 'string' },
                      rating: { type: 'number' },
                      image:  { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      });

      const payload = JSON.parse(completion.choices[0].message.content || '{"items":[]}');

      // 🔽 Enrich missing images with Unsplash (if key provided)
      const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
      if (UNSPLASH_ACCESS_KEY && Array.isArray(payload.items)) {
        const enriched = await Promise.all(
          payload.items.map(async (it) => {
            if (it.image && typeof it.image === 'string' && it.image.trim()) return it;

            const q = [it.title || '', category || '', city || '', state || '']
              .filter(Boolean)
              .join(' ')
              .trim();

            try {
              const u = new URL('https://api.unsplash.com/search/photos');
              u.searchParams.set('query', q || `${category} ${city}`);
              u.searchParams.set('per_page', '1');
              u.searchParams.set('orientation', 'landscape');
              u.searchParams.set('content_filter', 'high');
              u.searchParams.set('client_id', UNSPLASH_ACCESS_KEY);

              const r = await fetch(u.toString());
              if (r.ok) {
                const j = await r.json();
                const first = j?.results?.[0];
                const url = first?.urls?.regular || first?.urls?.small || first?.urls?.thumb || '';
                if (url) return { ...it, image: url };
              }
            } catch (_) {}
            return it;
          })
        );
        payload.items = enriched;
      }

      // ✅ Final safety net: guarantee every item has an image
      if (Array.isArray(payload.items)) {
        payload.items = payload.items.map(it => ({
          ...it,
          image: (it.image && String(it.image).trim())
            ? it.image
            : 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=1600&auto=format&fit=crop'
        }));
      }

      areaCache.set(key, payload);
    }

    res.json(areaCache.get(key));
  } catch (err) {
    console.error('poi error:', err?.response?.data || err);
    res.status(500).json({ error: 'openai_error', detail: String(err.message || err) });
  }
});

/* ------------------------------------------------------------------
   Compare two areas
------------------------------------------------------------------- */
app.post('/api/areas/compare', async (req, res) => {
  try {
    const { city, area1Name, area2Name } = req.body || {};
    if (!city || !area1Name) return res.status(400).json({ error: 'city and area1Name required' });

    const key = `cmp|${city}|${area1Name}|${area2Name || ''}`;
    if (!areaCache.has(key)) {
      const system = [
        'You are a relocation comparison assistant.',
        'Use only stable, historically-known characteristics (no live lookups).',
        'Return ONLY JSON as per schema.'
      ].join(' ');

      const user = {
        city,
        area1Name,
        area2Name: area2Name || '(choose a sensible contrasting area in the same city)'
      };

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Compare two areas with concise numbers and phrases: ${JSON.stringify(user)}` }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'AreaComparison',
            schema: {
              type: 'object',
              required: ['title','area1','area2','rows','overall','recommendation'],
              additionalProperties: false,
              properties: {
                title: { type: 'string' },
                area1: { type: 'string' },
                area2: { type: 'string' },
                rows: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['label','area1','area2'],
                    additionalProperties: false,
                    properties: {
                      label: { type: 'string' },
                      area1: { type: 'string' },
                      area2: { type: 'string' }
                    }
                  }
                },
                overall: {
                  type: 'object',
                  required: ['area1','area2'],
                  properties: { area1: { type: 'number' }, area2: { type: 'number' } }
                },
                vibe: {
                  type: 'object',
                  properties: { area1: { type: 'string' }, area2: { type: 'string' } }
                },
                recommendation: {
                  type: 'object',
                  required: ['name','rationale','tags'],
                  properties: {
                    name: { type: 'string' },
                    rationale: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' }, maxItems: 6 }
                  }
                }
              }
            }
          }
        }
      });

      const payload = JSON.parse(completion.choices[0].message.content || '{}');

      if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
        payload.rows = [
          { label: "School Rating /10", area1: "8.5", area2: "7.9" },
          { label: "Pet Amenities",     area1: "3 parks\n2 clinics", area2: "1 park\n1 clinic" },
          { label: "Healthcare",        area1: "2 hospitals\n1 ER",  area2: "1 clinic" },
          { label: "Commute Score /100",area1: "85 (subway, bike)",  area2: "60 (bus only)" }
        ];
      }
      payload.title ||= "Comparison Analysis";
      payload.area1 ||= area1Name;
      payload.area2 ||= area2Name || "Area 2";
      payload.overall ||= { area1: 9.1, area2: 7.1 };
      payload.recommendation ||= { name: area1Name, rationale: "", tags: [] };

      areaCache.set(key, payload);
    }

    res.json(areaCache.get(key));
  } catch (err) {
    console.error('compare error:', err?.response?.data || err);
    res.status(500).json({ error: 'openai_error', detail: String(err.message || err) });
  }
});

/* ------------------------------------------------------------------ */

// 🚀 Start server
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));



/*
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const OpenAI = require('openai'); // ⬅️ uses your OpenAI key

// 🔐 Load environment variables from .env
dotenv.config();

// ✅ Polyfill fetch if not available (Node <18)
globalThis.fetch ||= ((...args) =>
  import('node-fetch').then(m => m.default(...args))
);

// ✅ Internal modules
const connectDB = require('./config/db');
const User = require('./models/User');
const protectedRoute = require('./routes/protectedRoute');
const userRoutes = require('./routes/userRoutes');
const openaiRoute = require('./routes/openaiRoute');
const whisperRoute = require('./routes/whisperRoute');
const relocationRoute = require('./routes/relocationRoute'); // ⬅️ NEW

// 🔗 Connect to MongoDB
connectDB();

// ✅ Initialize express app
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // ensure body is parsed before routes

const JWT_SECRET = process.env.JWT_SECRET || 'super$ecretjwt|Token5182';

// ✅ Health checks
app.get('/', (_req, res) => {
  res.send('🚀 API is running and connected to MongoDB Atlas');
});
app.get('/health', (_req, res) => res.json({ ok: true }));

// ✅ Registration route
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    const savedUser = await newUser.save();

    res.status(201).json({
      id: savedUser._id,
      name: savedUser.name,
      email: savedUser.email,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Login route
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Feature routes
app.use('/api', protectedRoute);          
app.use('/user', userRoutes);             
app.use('/api', openaiRoute);             
app.use('/api/whisper', whisperRoute);    
app.use('/api/relocation', relocationRoute); 


const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const areaCache = new Map();


app.post('/api/areas/enrich', async (req, res) => {
  try {
    const { name, city, state, tags = [], budget, familySize } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });

    const cacheKey = `${name}|${city}|${state}|${tags.join(',')}|${budget || ''}|${familySize || ''}`;
    if (areaCache.has(cacheKey)) return res.json(areaCache.get(cacheKey));

    const systemPrompt = [
      'You are a relocation assistant. Generate stable, historically-known neighborhood summaries.',
      'Do NOT browse the web or use live data. If unsure for a field, return "unknown".',
      'Stick to widely-known, pre-2024 general characteristics only.',
      'Return ONLY JSON conforming to the provided schema.'
    ].join(' ');

    const userPayload = { name, city, state, tags, budget, familySize };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Enrich this place with historically-known info (no live lookups): ${JSON.stringify(userPayload)}` }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'AreaDetails',
          schema: {
            type: 'object',
            required: ['title','description','tags','metrics','heroImages'],
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' }, maxItems: 6 },
              heroImages: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 },
              metrics: {
                type: 'object',
                required: ['safety','schools','rent','commute'],
                properties: {
                  safety: {
                    type: 'object',
                    required: ['crime','score'],
                    properties: {
                      crime: { type: 'string', enum: ['Low','Medium','High','unknown'] },
                      score: { type: 'string' }
                    }
                  },
                  schools: {
                    type: 'object',
                    required: ['avg','count'],
                    properties: {
                      avg: { type: 'string' },
                      count: { type: 'string' }
                    }
                  },
                  rent: {
                    type: 'object',
                    required: ['avg'],
                    properties: { avg: { type: 'string' } }
                  },
                  commute: {
                    type: 'object',
                    required: ['downtown','airport'],
                    properties: {
                      downtown: { type: 'string' },
                      airport: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const payload = JSON.parse(completion.choices[0].message.content || '{}');

    if (!payload.heroImages || payload.heroImages.length === 0) {
      payload.heroImages = [
        'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=2000&auto=format&fit=crop'
      ];
    }

    areaCache.set(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    console.error('enrich error:', err?.response?.data || err);
    res.status(500).json({ error: 'openai_error', detail: String(err.message || err) });
  }
});


app.post('/api/areas/poi', async (req, res) => {
  try {
    const { name, city, state, category = 'Groceries', query = '', limit = 12 } = req.body || {};
    if (!name || !city) return res.status(400).json({ error: 'name and city required' });

    const key = `poi|${name}|${city}|${state}|${category}|${query}|${limit}`;
    if (!areaCache.has(key)) {
      const system = [
        'You list nearby places for a neighborhood using only stable, historically-known info.',
        'NO web browsing or live data. If unsure, provide plausible, generic examples typical for the area (well-known chains or districts).',
        'Return JSON only, conforming to schema. Keep titles succinct; subtitles one short line.'
      ].join(' ');

      const user = { name, city, state, category, query, limit };

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.5,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Return ${limit} items for this category and area: ${JSON.stringify(user)}` }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'POIList',
            schema: {
              type: 'object',
              required: ['items'],
              additionalProperties: false,
              properties: {
                items: {
                  type: 'array',
                  maxItems: limit,
                  items: {
                    type: 'object',
                    required: ['title', 'subtitle', 'rating', 'image'],
                    additionalProperties: false,
                    properties: {
                      title: { type: 'string' },
                      subtitle: { type: 'string' },
                      rating: { type: 'number' },
                      image:  { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      });

      const payload = JSON.parse(completion.choices[0].message.content || '{"items":[]}');

      // 🔽 NEW: Enrich missing images with Unsplash
      const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
      if (UNSPLASH_ACCESS_KEY && Array.isArray(payload.items)) {
        const enriched = await Promise.all(
          payload.items.map(async (it) => {
            if (it.image && typeof it.image === 'string' && it.image.trim()) return it;

            const q = [it.title || '', category || '', city || '', state || '']
              .filter(Boolean)
              .join(' ')
              .trim();

            try {
              const u = new URL('https://api.unsplash.com/search/photos');
              u.searchParams.set('query', q || `${category} ${city}`);
              u.searchParams.set('per_page', '1');
              u.searchParams.set('orientation', 'landscape');
              u.searchParams.set('content_filter', 'high');
              u.searchParams.set('client_id', UNSPLASH_ACCESS_KEY);

              const r = await fetch(u.toString());
              if (r.ok) {
                const j = await r.json();
                const first = j?.results?.[0];
                const url = first?.urls?.regular || first?.urls?.small || first?.urls?.thumb || '';
                if (url) return { ...it, image: url };
              }
            } catch (_) {}
            return it;
          })
        );
        payload.items = enriched;
      }

      areaCache.set(key, payload);
    }

    res.json(areaCache.get(key));
  } catch (err) {
    console.error('poi error:', err?.response?.data || err);
    res.status(500).json({ error: 'openai_error', detail: String(err.message || err) });
  }
});


app.post('/api/areas/compare', async (req, res) => {
  try {
    const { city, area1Name, area2Name } = req.body || {};
    if (!city || !area1Name) return res.status(400).json({ error: 'city and area1Name required' });

    const key = `cmp|${city}|${area1Name}|${area2Name || ''}`;
    if (!areaCache.has(key)) {
      const system = [
        'You are a relocation comparison assistant.',
        'Use only stable, historically-known characteristics (no live lookups).',
        'Return ONLY JSON as per schema.'
      ].join(' ');

      const user = {
        city,
        area1Name,
        area2Name: area2Name || '(choose a sensible contrasting area in the same city)'
      };

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Compare two areas with concise numbers and phrases: ${JSON.stringify(user)}` }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'AreaComparison',
            schema: {
              type: 'object',
              required: ['title','area1','area2','rows','overall','recommendation'],
              additionalProperties: false,
              properties: {
                title: { type: 'string' },
                area1: { type: 'string' },
                area2: { type: 'string' },
                rows: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['label','area1','area2'],
                    additionalProperties: false,
                    properties: {
                      label: { type: 'string' },
                      area1: { type: 'string' },
                      area2: { type: 'string' }
                    }
                  }
                },
                overall: {
                  type: 'object',
                  required: ['area1','area2'],
                  properties: { area1: { type: 'number' }, area2: { type: 'number' } }
                },
                vibe: {
                  type: 'object',
                  properties: { area1: { type: 'string' }, area2: { type: 'string' } }
                },
                recommendation: {
                  type: 'object',
                  required: ['name','rationale','tags'],
                  properties: {
                    name: { type: 'string' },
                    rationale: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' }, maxItems: 6 }
                  }
                }
              }
            }
          }
        }
      });

      const payload = JSON.parse(completion.choices[0].message.content || '{}');

      if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
        payload.rows = [
          { label: "School Rating /10", area1: "8.5", area2: "7.9" },
          { label: "Pet Amenities",     area1: "3 parks\n2 clinics", area2: "1 park\n1 clinic" },
          { label: "Healthcare",        area1: "2 hospitals\n1 ER",  area2: "1 clinic" },
          { label: "Commute Score /100",area1: "85 (subway, bike)",  area2: "60 (bus only)" }
        ];
      }
      payload.title ||= "Comparison Analysis";
      payload.area1 ||= area1Name;
      payload.area2 ||= area2Name || "Area 2";
      payload.overall ||= { area1: 9.1, area2: 7.1 };
      payload.recommendation ||= { name: area1Name, rationale: "", tags: [] };

      areaCache.set(key, payload);
    }

    res.json(areaCache.get(key));
  } catch (err) {
    console.error('compare error:', err?.response?.data || err);
    res.status(500).json({ error: 'openai_error', detail: String(err.message || err) });
  }
});



// 🚀 Start server
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
*/



/*
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const OpenAI = require('openai'); // ⬅️ uses your OpenAI key

// 🔐 Load environment variables from .env
dotenv.config();

// ✅ Internal modules
const connectDB = require('./config/db');
const User = require('./models/User');
const protectedRoute = require('./routes/protectedRoute');
const userRoutes = require('./routes/userRoutes');
const openaiRoute = require('./routes/openaiRoute');
const whisperRoute = require('./routes/whisperRoute');
const relocationRoute = require('./routes/relocationRoute'); // ⬅️ NEW

// 🔗 Connect to MongoDB
connectDB();

// ✅ Initialize express app
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // ensure body is parsed before routes

const JWT_SECRET = process.env.JWT_SECRET || 'super$ecretjwt|Token5182';

// ✅ Health checks
app.get('/', (_req, res) => {
  res.send('🚀 API is running and connected to MongoDB Atlas');
});
app.get('/health', (_req, res) => res.json({ ok: true })); // ⬅️ handy for curl

// ✅ Registration route
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    const savedUser = await newUser.save();

    res.status(201).json({
      id: savedUser._id,
      name: savedUser.name,
      email: savedUser.email,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Login route
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Feature routes
app.use('/api', protectedRoute);          // e.g., /api/dashboard
app.use('/user', userRoutes);             // e.g., /user/profile
app.use('/api', openaiRoute);             // e.g., /api/generate
app.use('/api/whisper', whisperRoute);    // e.g., /api/whisper/transcribe
app.use('/api/relocation', relocationRoute); // ⬅️ /api/relocation/recommend + /relocate


const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const areaCache = new Map();


app.post('/api/areas/enrich', async (req, res) => {
  try {
    // ⬇️ FIXED: removed default = 'CA'
    const { name, city, state, tags = [], budget, familySize } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });

    const cacheKey = `${name}|${city}|${state}|${tags.join(',')}|${budget || ''}|${familySize || ''}`;
    if (areaCache.has(cacheKey)) return res.json(areaCache.get(cacheKey));

    const systemPrompt = [
      'You are a relocation assistant. Generate stable, historically-known neighborhood summaries.',
      'Do NOT browse the web or use live data. If unsure for a field, return "unknown".',
      'Stick to widely-known, pre-2024 general characteristics only.',
      'Return ONLY JSON conforming to the provided schema.'
    ].join(' ');

    const userPayload = { name, city, state, tags, budget, familySize };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Enrich this place with historically-known info (no live lookups): ${JSON.stringify(userPayload)}` }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'AreaDetails',
          schema: {
            type: 'object',
            required: ['title','description','tags','metrics','heroImages'],
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' }, maxItems: 6 },
              heroImages: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 },
              metrics: {
                type: 'object',
                required: ['safety','schools','rent','commute'],
                properties: {
                  safety: {
                    type: 'object',
                    required: ['crime','score'],
                    properties: {
                      crime: { type: 'string', enum: ['Low','Medium','High','unknown'] },
                      score: { type: 'string' }
                    }
                  },
                  schools: {
                    type: 'object',
                    required: ['avg','count'],
                    properties: {
                      avg: { type: 'string' },
                      count: { type: 'string' }
                    }
                  },
                  rent: {
                    type: 'object',
                    required: ['avg'],
                    properties: { avg: { type: 'string' } }
                  },
                  commute: {
                    type: 'object',
                    required: ['downtown','airport'],
                    properties: {
                      downtown: { type: 'string' },
                      airport: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const payload = JSON.parse(completion.choices[0].message.content || '{}');

    if (!payload.heroImages || payload.heroImages.length === 0) {
      payload.heroImages = [
        'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=2000&auto=format&fit=crop'
      ];
    }

    areaCache.set(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    console.error('enrich error:', err?.response?.data || err);
    res.status(500).json({ error: 'openai_error', detail: String(err.message || err) });
  }
});


app.post('/api/areas/poi', async (req, res) => {
  try {
    // ⬇️ FIXED: removed default = 'CA'
    const { name, city, state, category = 'Groceries', query = '', limit = 12 } = req.body || {};
    if (!name || !city) return res.status(400).json({ error: 'name and city required' });

    const key = `poi|${name}|${city}|${state}|${category}|${query}|${limit}`;
    if (!areaCache.has(key)) {
      const system = [
        'You list nearby places for a neighborhood using only stable, historically-known info.',
        'NO web browsing or live data. If unsure, provide plausible, generic examples typical for the area (well-known chains or districts).',
        'Return JSON only, conforming to schema. Keep titles succinct; subtitles one short line.'
      ].join(' ');

      const user = { name, city, state, category, query, limit };

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.5,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Return ${limit} items for this category and area: ${JSON.stringify(user)}` }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'POIList',
            schema: {
              type: 'object',
              required: ['items'],
              additionalProperties: false,
              properties: {
                items: {
                  type: 'array',
                  maxItems: limit,
                  items: {
                    type: 'object',
                    required: ['title', 'subtitle', 'rating', 'image'],
                    additionalProperties: false,
                    properties: {
                      title: { type: 'string' },
                      subtitle: { type: 'string' },
                      rating: { type: 'number' },
                      image:  { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      });

      const payload = JSON.parse(completion.choices[0].message.content || '{"items":[]}');
      areaCache.set(key, payload);
    }

    res.json(areaCache.get(key));
  } catch (err) {
    console.error('poi error:', err?.response?.data || err);
    res.status(500).json({ error: 'openai_error', detail: String(err.message || err) });
  }
});


app.post('/api/areas/compare', async (req, res) => {
  try {
    const { city, area1Name, area2Name } = req.body || {};
    if (!city || !area1Name) return res.status(400).json({ error: 'city and area1Name required' });

    const key = `cmp|${city}|${area1Name}|${area2Name || ''}`;
    if (!areaCache.has(key)) {
      const system = [
        'You are a relocation comparison assistant.',
        'Use only stable, historically-known characteristics (no live lookups).',
        'Return ONLY JSON as per schema.'
      ].join(' ');

      const user = {
        city,
        area1Name,
        area2Name: area2Name || '(choose a sensible contrasting area in the same city)'
      };

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Compare two areas with concise numbers and phrases: ${JSON.stringify(user)}` }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'AreaComparison',
            schema: {
              type: 'object',
              required: ['title','area1','area2','rows','overall','recommendation'],
              additionalProperties: false,
              properties: {
                title: { type: 'string' },
                area1: { type: 'string' },
                area2: { type: 'string' },
                rows: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['label','area1','area2'],
                    additionalProperties: false,
                    properties: {
                      label: { type: 'string' },
                      area1: { type: 'string' },
                      area2: { type: 'string' }
                    }
                  }
                },
                overall: {
                  type: 'object',
                  required: ['area1','area2'],
                  properties: { area1: { type: 'number' }, area2: { type: 'number' } }
                },
                vibe: {
                  type: 'object',
                  properties: { area1: { type: 'string' }, area2: { type: 'string' } }
                },
                recommendation: {
                  type: 'object',
                  required: ['name','rationale','tags'],
                  properties: {
                    name: { type: 'string' },
                    rationale: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' }, maxItems: 6 }
                  }
                }
              }
            }
          }
        }
      });

      const payload = JSON.parse(completion.choices[0].message.content || '{}');

      // Sensible defaults if model leaves anything out
      if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
        payload.rows = [
          { label: "School Rating /10", area1: "8.5", area2: "7.9" },
          { label: "Pet Amenities",     area1: "3 parks\n2 clinics", area2: "1 park\n1 clinic" },
          { label: "Healthcare",        area1: "2 hospitals\n1 ER",  area2: "1 clinic" },
          { label: "Commute Score /100",area1: "85 (subway, bike)",  area2: "60 (bus only)" }
        ];
      }
      payload.title ||= "Comparison Analysis";
      payload.area1 ||= area1Name;
      payload.area2 ||= area2Name || "Area 2";
      payload.overall ||= { area1: 9.1, area2: 7.1 };
      payload.recommendation ||= { name: area1Name, rationale: "", tags: [] };

      areaCache.set(key, payload);
    }

    res.json(areaCache.get(key));
  } catch (err) {
    console.error('compare error:', err?.response?.data || err);
    res.status(500).json({ error: 'openai_error', detail: String(err.message || err) });
  }
});



// 🚀 Start server
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
*/



/*
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const OpenAI = require('openai'); // ⬅️ uses your OpenAI key

// 🔐 Load environment variables from .env
dotenv.config();

// ✅ Internal modules
const connectDB = require('./config/db');
const User = require('./models/User');
const protectedRoute = require('./routes/protectedRoute');
const userRoutes = require('./routes/userRoutes');
const openaiRoute = require('./routes/openaiRoute');
const whisperRoute = require('./routes/whisperRoute');
const relocationRoute = require('./routes/relocationRoute'); // ⬅️ NEW

// 🔗 Connect to MongoDB
connectDB();

// ✅ Initialize express app
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // ensure body is parsed before routes

const JWT_SECRET = process.env.JWT_SECRET || 'super$ecretjwt|Token5182';

// ✅ Health checks
app.get('/', (_req, res) => {
  res.send('🚀 API is running and connected to MongoDB Atlas');
});
app.get('/health', (_req, res) => res.json({ ok: true })); // ⬅️ handy for curl

// ✅ Registration route
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    const savedUser = await newUser.save();

    res.status(201).json({
      id: savedUser._id,
      name: savedUser.name,
      email: savedUser.email,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Login route
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Feature routes
app.use('/api', protectedRoute);          // e.g., /api/dashboard
app.use('/user', userRoutes);             // e.g., /user/profile
app.use('/api', openaiRoute);             // e.g., /api/generate
app.use('/api/whisper', whisperRoute);    // e.g., /api/whisper/transcribe
app.use('/api/relocation', relocationRoute); // ⬅️ /api/relocation/recommend + /relocate

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const areaCache = new Map();


app.post('/api/areas/enrich', async (req, res) => {
  try {
    const { name, city, state = 'CA', tags = [], budget, familySize } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });

    const cacheKey = `${name}|${city}|${state}|${tags.join(',')}|${budget || ''}|${familySize || ''}`;
    if (areaCache.has(cacheKey)) return res.json(areaCache.get(cacheKey));

    const systemPrompt = [
      'You are a relocation assistant. Generate stable, historically-known neighborhood summaries.',
      'Do NOT browse the web or use live data. If unsure for a field, return "unknown".',
      'Stick to widely-known, pre-2024 general characteristics only.',
      'Return ONLY JSON conforming to the provided schema.'
    ].join(' ');

    const userPayload = { name, city, state, tags, budget, familySize };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Enrich this place with historically-known info (no live lookups): ${JSON.stringify(userPayload)}` }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'AreaDetails',
          schema: {
            type: 'object',
            required: ['title','description','tags','metrics','heroImages'],
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' }, maxItems: 6 },
              heroImages: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 },
              metrics: {
                type: 'object',
                required: ['safety','schools','rent','commute'],
                properties: {
                  safety: {
                    type: 'object',
                    required: ['crime','score'],
                    properties: {
                      crime: { type: 'string', enum: ['Low','Medium','High','unknown'] },
                      score: { type: 'string' }
                    }
                  },
                  schools: {
                    type: 'object',
                    required: ['avg','count'],
                    properties: {
                      avg: { type: 'string' },
                      count: { type: 'string' }
                    }
                  },
                  rent: {
                    type: 'object',
                    required: ['avg'],
                    properties: { avg: { type: 'string' } }
                  },
                  commute: {
                    type: 'object',
                    required: ['downtown','airport'],
                    properties: {
                      downtown: { type: 'string' },
                      airport: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const payload = JSON.parse(completion.choices[0].message.content || '{}');

    if (!payload.heroImages || payload.heroImages.length === 0) {
      payload.heroImages = [
        'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=2000&auto=format&fit=crop'
      ];
    }

    areaCache.set(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    console.error('enrich error:', err?.response?.data || err);
    res.status(500).json({ error: 'openai_error', detail: String(err.message || err) });
  }
});


app.post('/api/areas/poi', async (req, res) => {
  try {
    const { name, city, state = 'CA', category = 'Groceries', query = '', limit = 12 } = req.body || {};
    if (!name || !city) return res.status(400).json({ error: 'name and city required' });

    const key = `poi|${name}|${city}|${state}|${category}|${query}|${limit}`;
    if (!areaCache.has(key)) {
      const system = [
        'You list nearby places for a neighborhood using only stable, historically-known info.',
        'NO web browsing or live data. If unsure, provide plausible, generic examples typical for the area (well-known chains or districts).',
        'Return JSON only, conforming to schema. Keep titles succinct; subtitles one short line.'
      ].join(' ');

      const user = { name, city, state, category, query, limit };

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.5,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Return ${limit} items for this category and area: ${JSON.stringify(user)}` }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'POIList',
            schema: {
              type: 'object',
              required: ['items'],
              additionalProperties: false,
              properties: {
                items: {
                  type: 'array',
                  maxItems: limit,
                  items: {
                    type: 'object',
                    required: ['title', 'subtitle', 'rating', 'image'],
                    additionalProperties: false,
                    properties: {
                      title: { type: 'string' },
                      subtitle: { type: 'string' },
                      rating: { type: 'number' },
                      image:  { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      });

      const payload = JSON.parse(completion.choices[0].message.content || '{"items":[]}');
      areaCache.set(key, payload);
    }

    res.json(areaCache.get(key));
  } catch (err) {
    console.error('poi error:', err?.response?.data || err);
    res.status(500).json({ error: 'openai_error', detail: String(err.message || err) });
  }
});


app.post('/api/areas/compare', async (req, res) => {
  try {
    const { city, area1Name, area2Name } = req.body || {};
    if (!city || !area1Name) return res.status(400).json({ error: 'city and area1Name required' });

    const key = `cmp|${city}|${area1Name}|${area2Name || ''}`;
    if (!areaCache.has(key)) {
      const system = [
        'You are a relocation comparison assistant.',
        'Use only stable, historically-known characteristics (no live lookups).',
        'Return ONLY JSON as per schema.'
      ].join(' ');

      const user = {
        city,
        area1Name,
        area2Name: area2Name || '(choose a sensible contrasting area in the same city)'
      };

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Compare two areas with concise numbers and phrases: ${JSON.stringify(user)}` }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'AreaComparison',
            schema: {
              type: 'object',
              required: ['title','area1','area2','rows','overall','recommendation'],
              additionalProperties: false,
              properties: {
                title: { type: 'string' },
                area1: { type: 'string' },
                area2: { type: 'string' },
                rows: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['label','area1','area2'],
                    additionalProperties: false,
                    properties: {
                      label: { type: 'string' },
                      area1: { type: 'string' },
                      area2: { type: 'string' }
                    }
                  }
                },
                overall: {
                  type: 'object',
                  required: ['area1','area2'],
                  properties: { area1: { type: 'number' }, area2: { type: 'number' } }
                },
                vibe: {
                  type: 'object',
                  properties: { area1: { type: 'string' }, area2: { type: 'string' } }
                },
                recommendation: {
                  type: 'object',
                  required: ['name','rationale','tags'],
                  properties: {
                    name: { type: 'string' },
                    rationale: { type: 'string' },
                    tags: { type: 'array', items: { type: 'string' }, maxItems: 6 }
                  }
                }
              }
            }
          }
        }
      });

      const payload = JSON.parse(completion.choices[0].message.content || '{}');

      // Sensible defaults if model leaves anything out
      if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
        payload.rows = [
          { label: "School Rating /10", area1: "8.5", area2: "7.9" },
          { label: "Pet Amenities",     area1: "3 parks\n2 clinics", area2: "1 park\n1 clinic" },
          { label: "Healthcare",        area1: "2 hospitals\n1 ER",  area2: "1 clinic" },
          { label: "Commute Score /100",area1: "85 (subway, bike)",  area2: "60 (bus only)" }
        ];
      }
      payload.title ||= "Comparison Analysis";
      payload.area1 ||= area1Name;
      payload.area2 ||= area2Name || "Area 2";
      payload.overall ||= { area1: 9.1, area2: 7.1 };
      payload.recommendation ||= { name: area1Name, rationale: "", tags: [] };

      areaCache.set(key, payload);
    }

    res.json(areaCache.get(key));
  } catch (err) {
    console.error('compare error:', err?.response?.data || err);
    res.status(500).json({ error: 'openai_error', detail: String(err.message || err) });
  }
});



// 🚀 Start server
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
*/




/*
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const OpenAI = require('openai'); // ⬅️ uses your OpenAI key

// 🔐 Load environment variables from .env
dotenv.config();

// ✅ Internal modules
const connectDB = require('./config/db');
const User = require('./models/User');
const protectedRoute = require('./routes/protectedRoute');
const userRoutes = require('./routes/userRoutes');
const openaiRoute = require('./routes/openaiRoute');
const whisperRoute = require('./routes/whisperRoute');
const relocationRoute = require('./routes/relocationRoute'); // ⬅️ NEW

// 🔗 Connect to MongoDB
connectDB();

// ✅ Initialize express app
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // ensure body is parsed before routes

const JWT_SECRET = process.env.JWT_SECRET || 'super$ecretjwt|Token5182';

// ✅ Health checks
app.get('/', (_req, res) => {
  res.send('🚀 API is running and connected to MongoDB Atlas');
});
app.get('/health', (_req, res) => res.json({ ok: true })); // ⬅️ handy for curl

// ✅ Registration route
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    const savedUser = await newUser.save();

    res.status(201).json({
      id: savedUser._id,
      name: savedUser.name,
      email: savedUser.email,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Login route
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Feature routes
app.use('/api', protectedRoute);          // e.g., /api/dashboard
app.use('/user', userRoutes);             // e.g., /user/profile
app.use('/api', openaiRoute);             // e.g., /api/generate
app.use('/api/whisper', whisperRoute);    // e.g., /api/whisper/transcribe
app.use('/api/relocation', relocationRoute); // ⬅️ /api/relocation/recommend + /relocate



const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const areaCache = new Map(); // simple in-memory dev cache

app.post('/api/areas/enrich', async (req, res) => {
  try {
    const {
      name,               // e.g., "Pasadena"
      city,               // e.g., "Los Angeles"
      state = 'CA',
      tags = [],          // e.g., ["quiet suburb", "family-friendly"]
      budget,
      familySize
    } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const cacheKey = `${name}|${city}|${state}|${tags.join(',')}|${budget || ''}|${familySize || ''}`;
    if (areaCache.has(cacheKey)) {
      return res.json(areaCache.get(cacheKey));
    }

    const systemPrompt = [
      'You are a relocation assistant. Generate stable, historically-known neighborhood summaries.',
      'Do NOT browse the web or use live data. If unsure for a field, return "unknown".',
      'Stick to widely-known, pre-2024 general characteristics only.',
      'Return ONLY JSON conforming to the provided schema.'
    ].join(' ');

    const userPayload = { name, city, state, tags, budget, familySize };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Enrich this place with historically-known info (no live lookups): ${JSON.stringify(userPayload)}` }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'AreaDetails',
          schema: {
            type: 'object',
            required: ['title','description','tags','metrics','heroImages'],
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' }, maxItems: 6 },
              heroImages: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 },
              metrics: {
                type: 'object',
                required: ['safety','schools','rent','commute'],
                properties: {
                  safety: {
                    type: 'object',
                    required: ['crime','score'],
                    properties: {
                      crime: { type: 'string', enum: ['Low','Medium','High','unknown'] },
                      score: { type: 'string' } // e.g., "9/10"
                    }
                  },
                  schools: {
                    type: 'object',
                    required: ['avg','count'],
                    properties: {
                      avg: { type: 'string' },    // "8/10"
                      count: { type: 'string' }   // "5"
                    }
                  },
                  rent: {
                    type: 'object',
                    required: ['avg'],
                    properties: {
                      avg: { type: 'string' }     // "$2,500" ballpark
                    }
                  },
                  commute: {
                    type: 'object',
                    required: ['downtown','airport'],
                    properties: {
                      downtown: { type: 'string' }, // "20–30 min"
                      airport: { type: 'string' }   // "30–45 min"
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const payload = JSON.parse(completion.choices[0].message.content || '{}');

    // Fallback image if model omits
    if (!payload.heroImages || payload.heroImages.length === 0) {
      payload.heroImages = [
        'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=2000&auto=format&fit=crop'
      ];
    }

    areaCache.set(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    console.error('enrich error:', err?.response?.data || err);
    res.status(500).json({ error: 'openai_error', detail: String(err.message || err) });
  }
});



app.post('/api/areas/poi', async (req, res) => {
  try {
    const { name, city, state = 'CA', category = 'Groceries', query = '', limit = 12 } = req.body || {};
    if (!name || !city) return res.status(400).json({ error: 'name and city required' });

    const key = `poi|${name}|${city}|${state}|${category}|${query}|${limit}`;
    if (!areaCache.has(key)) {
      const system = [
        'You list nearby places for a neighborhood using only stable, historically-known info.',
        'NO web browsing or live data. If unsure, provide plausible, generic examples typical for the area (well-known chains or districts).',
        'Return JSON only, conforming to schema. Keep titles succinct; subtitles one short line.'
      ].join(' ');

      const user = { name, city, state, category, query, limit };

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.5,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Return ${limit} items for this category and area: ${JSON.stringify(user)}` }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'POIList',
            schema: {
              type: 'object',
              required: ['items'],
              additionalProperties: false,
              properties: {
                items: {
                  type: 'array',
                  maxItems: limit,
                  items: {
                    type: 'object',
                    required: ['title', 'subtitle', 'rating', 'image'],
                    additionalProperties: false,
                    properties: {
                      title: { type: 'string' },
                      subtitle: { type: 'string' },  // brief descriptor
                      rating: { type: 'number' },    // 0-5
                      image:  { type: 'string' }     // stock/unsplash-like url ok
                    }
                  }
                }
              }
            }
          }
        }
      });

      const payload = JSON.parse(completion.choices[0].message.content || '{"items":[]}');
      areaCache.set(key, payload);
    }

    res.json(areaCache.get(key));
  } catch (err) {
    console.error('poi error:', err?.response?.data || err);
    res.status(500).json({ error: 'openai_error', detail: String(err.message || err) });
  }
});



// 🚀 Start server
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
*/


/*
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const OpenAI = require('openai'); // ⬅️ NEW

// 🔐 Load environment variables from .env
dotenv.config();

// ✅ Internal modules
const connectDB = require('./config/db');
const User = require('./models/User');
const protectedRoute = require('./routes/protectedRoute');
const userRoutes = require('./routes/userRoutes');
const openaiRoute = require('./routes/openaiRoute');
const whisperRoute = require('./routes/whisperRoute');
const relocationRoute = require('./routes/relocationRoute'); // ⬅️ NEW

// 🔗 Connect to MongoDB
connectDB();

// ✅ Initialize express app
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // ensure body is parsed before routes

const JWT_SECRET = process.env.JWT_SECRET || 'super$ecretjwt|Token5182';

// ✅ Health checks
app.get('/', (_req, res) => {
  res.send('🚀 API is running and connected to MongoDB Atlas');
});
app.get('/health', (_req, res) => res.json({ ok: true })); // ⬅️ handy for curl

// ✅ Registration route
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    const savedUser = await newUser.save();

    res.status(201).json({
      id: savedUser._id,
      name: savedUser.name,
      email: savedUser.email,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Login route
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Feature routes
app.use('/api', protectedRoute);          // e.g., /api/dashboard
app.use('/user', userRoutes);             // e.g., /user/profile
app.use('/api', openaiRoute);             // e.g., /api/generate
app.use('/api/whisper', whisperRoute);    // e.g., /api/whisper/transcribe
app.use('/api/relocation', relocationRoute); // ⬅️ /api/relocation/recommend + /relocate


const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const areaCache = new Map(); // simple in-memory dev cache

app.post('/api/areas/enrich', async (req, res) => {
  try {
    const {
      name,               // e.g., "Pasadena"
      city,               // e.g., "Los Angeles"
      state = 'CA',
      tags = [],          // e.g., ["quiet suburb", "family-friendly"]
      budget,
      familySize
    } = req.body || {};

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const cacheKey = `${name}|${city}|${state}|${tags.join(',')}|${budget || ''}|${familySize || ''}`;
    if (areaCache.has(cacheKey)) {
      return res.json(areaCache.get(cacheKey));
    }

    const systemPrompt = [
      'You are a relocation assistant. Generate stable, historically-known neighborhood summaries.',
      'Do NOT browse the web or use live data. If unsure for a field, return "unknown".',
      'Stick to widely-known, pre-2024 general characteristics only.',
      'Return ONLY JSON conforming to the provided schema.'
    ].join(' ');

    const userPayload = { name, city, state, tags, budget, familySize };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content:
            `Enrich this place with historically-known info (no live lookups): ${JSON.stringify(userPayload)}`
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'AreaDetails',
          schema: {
            type: 'object',
            required: ['title','description','tags','metrics','heroImages'],
            additionalProperties: false,
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' }, maxItems: 6 },
              heroImages: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 5 },
              metrics: {
                type: 'object',
                required: ['safety','schools','rent','commute'],
                properties: {
                  safety: {
                    type: 'object',
                    required: ['crime','score'],
                    properties: {
                      crime: { type: 'string', enum: ['Low','Medium','High','unknown'] },
                      score: { type: 'string' } // e.g., "9/10"
                    }
                  },
                  schools: {
                    type: 'object',
                    required: ['avg','count'],
                    properties: {
                      avg: { type: 'string' },    // "8/10"
                      count: { type: 'string' }   // "5"
                    }
                  },
                  rent: {
                    type: 'object',
                    required: ['avg'],
                    properties: {
                      avg: { type: 'string' }     // "$2,500" ballpark
                    }
                  },
                  commute: {
                    type: 'object',
                    required: ['downtown','airport'],
                    properties: {
                      downtown: { type: 'string' }, // "20–30 min"
                      airport: { type: 'string' }   // "30–45 min"
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const payload = JSON.parse(completion.choices[0].message.content || '{}');

    // Fallback image if model omits
    if (!payload.heroImages || payload.heroImages.length === 0) {
      payload.heroImages = [
        'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=2000&auto=format&fit=crop'
      ];
    }

    areaCache.set(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    console.error('enrich error:', err?.response?.data || err);
    res.status(500).json({ error: 'openai_error', detail: String(err.message || err) });
  }
});



// 🚀 Start server
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
*/


/*
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

// 🔐 Load environment variables from .env
dotenv.config();

// ✅ Internal modules
const connectDB = require('./config/db');
const User = require('./models/User');
const protectedRoute = require('./routes/protectedRoute');
const userRoutes = require('./routes/userRoutes');
const openaiRoute = require('./routes/openaiRoute');
const whisperRoute = require('./routes/whisperRoute');
const relocationRoute = require('./routes/relocationRoute'); // ⬅️ NEW

// 🔗 Connect to MongoDB
connectDB();

// ✅ Initialize express app
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // ensure body is parsed before routes

const JWT_SECRET = process.env.JWT_SECRET || 'super$ecretjwt|Token5182';

// ✅ Health checks
app.get('/', (_req, res) => {
  res.send('🚀 API is running and connected to MongoDB Atlas');
});
app.get('/health', (_req, res) => res.json({ ok: true })); // ⬅️ handy for curl

// ✅ Registration route
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    const savedUser = await newUser.save();

    res.status(201).json({
      id: savedUser._id,
      name: savedUser.name,
      email: savedUser.email,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Login route
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Feature routes
app.use('/api', protectedRoute);          // e.g., /api/dashboard
app.use('/user', userRoutes);             // e.g., /user/profile
app.use('/api', openaiRoute);             // e.g., /api/generate
app.use('/api/whisper', whisperRoute);    // e.g., /api/whisper/transcribe
app.use('/api/relocation', relocationRoute); // ⬅️ NEW: /api/relocation/recommend + /relocate

// 🚀 Start server
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
*/


/*
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

// ✅ Internal modules
const connectDB = require('./config/db');
const User = require('./models/User');
const protectedRoute = require('./routes/protectedRoute');
const userRoutes = require('./routes/userRoutes');
const openaiRoute = require('./routes/openaiRoute'); // ✅ Add this line

const whisperRoute = require('./routes/whisperRoute');
app.use('/api/whisper', whisperRoute);

const openaiRoute = require('./routes/openaiRoute');
app.use('/api', openaiRoute);



// 🔐 Load environment variables from .env
dotenv.config();

// 🔗 Connect to MongoDB
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'super$ecretjwt|Token5182';

// ✅ Health check route
app.get('/', (req, res) => {
  res.send('🚀 API is running and connected to MongoDB Atlas');
});

// ✅ Registration route
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    const savedUser = await newUser.save();

    res.status(201).json({
      id: savedUser._id,
      name: savedUser.name,
      email: savedUser.email,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Login route
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Routes
app.use('/api', protectedRoute);    // e.g., /api/dashboard
app.use('/user', userRoutes);       // e.g., /user/profile
app.use('/api', openaiRoute);       // ✅ Register OpenAI route e.g., /api/generate

// 🚀 Start server
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
*/




/*
// server/app/server.js

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

// ✅ Correct paths (you're inside server/app)
const connectDB = require('./config/db');
const User = require('./models/User');
const protectedRoute = require('./routes/protectedRoute');
const userRoutes = require('./routes/userRoutes');

// 🔐 Load environment variables from .env
dotenv.config();

// 🔗 Connect to MongoDB
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'super$ecretjwt|Token5182';

// ✅ Health check route
app.get('/', (req, res) => {
  res.send('🚀 API is running and connected to MongoDB Atlas');
});

// ✅ Registration route
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    const savedUser = await newUser.save();

    res.status(201).json({
      id: savedUser._id,
      name: savedUser.name,
      email: savedUser.email,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Login route
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Routes
app.use('/api', protectedRoute);  // e.g., /api/dashboard
app.use('/user', userRoutes);     // e.g., /user/profile, /user/saved

// 🚀 Start server
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));




/*const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const connectDB = require('./config/db');
const User = require('./models/User');
const protectedRoute = require('./routes/protectedRoute');
const userRoutes = require('./routes/userRoutes');

// 🔐 Load environment variables from .env
dotenv.config();

// 🔗 Connect to MongoDB
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'super$ecretjwt|Token5182';

// ✅ Health check route
app.get('/', (req, res) => {
  res.send('🚀 API is running and connected to MongoDB Atlas');
});

// ✅ Registration route (final version)
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save new user
    const newUser = new User({ name, email, password: hashedPassword });
    const savedUser = await newUser.save();

    res.status(201).json({
      id: savedUser._id,
      name: savedUser.name,
      email: savedUser.email,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Login route that returns a JWT token
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    // Generate JWT
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ✅ Protected routes
app.use('/api', protectedRoute);
app.use('/user', userRoutes);

// 🚀 Start server
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
*/

















/*
const express = require('express');
const jwt = require('jsonwebtoken');
const protectedRoute = require('./routes/protectedRoute');

const app = express();
app.use(express.json());

const JWT_SECRET = 'super$ecretjwt|Token5182';

// Sample login route to generate token
app.post('/api/login', (req, res) => {
  const user = { id: 1, username: 'testuser' };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

app.use('/api', protectedRoute);

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
*/
