// models/User.js

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  persona: {
    type: String,
    enum: ['relocating', 'exploring', null],
    default: null,
  },
  savedServices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
  }],
  location: {
    type: {
      type: String, // e.g., 'Point'
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);













/*
// models/User.js

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
});

module.exports = mongoose.model('User', userSchema);
*/
