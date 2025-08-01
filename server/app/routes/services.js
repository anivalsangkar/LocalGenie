const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

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
