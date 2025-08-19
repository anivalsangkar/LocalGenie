const express = require('express');
const cors = require('cors');

const app = express();

// Use 5050 to avoid clashing with CRA (frontend dev runs on 3000)
const port = process.env.PORT || 5050;

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- Routes ---
const openaiRoute = require('./app/routes/openaiRoute');
const relocationRoute = require('./app/routes/relocationRoute'); // <- NEW
let whisperRoute;
try {
  // mount if present in your repo
  whisperRoute = require('./app/routes/whisperRoute');
} catch (_) { /* optional */ }

app.use('/api', openaiRoute);
app.use('/api/relocation', relocationRoute); // <- NEW
if (whisperRoute) app.use('/api/whisper', whisperRoute);

// --- Sample data + demo endpoints (kept from your file) ---
const services = [
  { id: 1, name: 'Joe’s Pizza', location: 'Chicago', type: 'Restaurants' },
  { id: 2, name: 'City Spa', location: 'Chicago', type: 'Wellness' },
  { id: 3, name: 'Burger Queen', location: 'New York', type: 'Restaurants' },
];

const userFavorites = {};

app.get('/services', (req, res) => {
  const { location, type } = req.query;
  const filtered = services.filter(service =>
    (!location || service.location === location) &&
    (!type || service.type === type)
  );
  res.json(filtered);
});

app.post('/user/save-service', (req, res) => {
  const { userId, serviceId } = req.body;
  if (!userId || !serviceId) {
    return res.status(400).json({ error: 'Missing userId or serviceId' });
  }
  if (!userFavorites[userId]) userFavorites[userId] = [];
  if (!userFavorites[userId].includes(serviceId)) {
    userFavorites[userId].push(serviceId);
  }
  res.json({ message: 'Service saved to favorites', favorites: userFavorites[userId] });
});

// --- Health check ---
app.get('/health', (_req, res) => res.json({ ok: true }));

// --- Start ---
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});





/*
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;
const openaiRoute = require('./app/routes/openaiRoute');

app.use('/api', openaiRoute);
app.use(bodyParser.json());
app.use(require('cors')());

//Sample data
const services = [
  { id: 1, name: 'Joe’s Pizza', location: 'Chicago', type: 'Restaurants' },
  { id: 2, name: 'City Spa', location: 'Chicago', type: 'Wellness' },
  { id: 3, name: 'Burger Queen', location: 'New York', type: 'Restaurants' },
];

const userFavorites = {};

app.get('/services', (req, res) => {
  const { location, type } = req.query;
  const filtered = services.filter(service =>
    (!location || service.location === location) &&
    (!type || service.type === type)
  );
  res.json(filtered);
});

//Saving services to user favourites
app.post('/user/save-service', (req, res) => {
  const { userId, serviceId } = req.body;
  if (!userId || !serviceId) return res.status(400).json({ error: 'Missing userId or serviceId' });

  if (!userFavorites[userId]) userFavorites[userId] = [];
  if (!userFavorites[userId].includes(serviceId)) userFavorites[userId].push(serviceId);

  res.json({ message: 'Service saved to favorites', favorites: userFavorites[userId] });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
*/