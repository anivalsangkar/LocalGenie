// config/db.js

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Debug: print the MONGO_URI to check if env is loaded
    console.log('MONGO_URI:', process.env.MONGO_URI);
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1); // Stop the server if DB fails to connect
  }
};

module.exports = connectDB;
