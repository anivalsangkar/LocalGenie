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
