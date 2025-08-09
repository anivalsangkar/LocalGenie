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

// 🔗 Connect to MongoDB
connectDB();

// ✅ Initialize express app
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

// ✅ API Routes
app.use('/api', protectedRoute);      // e.g., /api/dashboard
app.use('/user', userRoutes);         // e.g., /user/profile
app.use('/api', openaiRoute);         // e.g., /api/generate
app.use('/api/whisper', whisperRoute); // e.g., /api/whisper/transcribe

// 🚀 Start server
const PORT = process.env.PORT || 5050;
app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));






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