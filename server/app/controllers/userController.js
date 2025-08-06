const User = require('../models/User');
const asyncHandler = require('express-async-handler');

// Get valid persona values from schema
const validPersonas = User.schema.path('persona').enumValues.filter(Boolean);

// @desc    Get user profile
// @route   GET /user/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  
  if (!user) {
    return res.status(404).json({ 
      success: false,
      message: 'User not found' 
    });
  }
  
  res.status(200).json({
    success: true,
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      persona: user.persona
    }
  });
});

// @desc    Update user persona
// @route   PUT /user/persona
// @access  Private
const updatePersona = asyncHandler(async (req, res) => {
  const { persona } = req.body;
  
  if (!persona || !validPersonas.includes(persona)) {
    return res.status(400).json({
      success: false,
      message: `Please provide a valid persona: ${validPersonas.join(' or ')}`
    });
  }
  
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { persona },
    { new: true, runValidators: true }
  ).select('-password');
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: {
      id: user._id,
      persona: user.persona
    }
  });
});

// @desc    Get user's saved services
// @route   GET /user/saved
// @access  Private
const getSavedServices = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id)
    .select('savedServices')
    .populate('savedServices', 'name description category');
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }
  
  res.status(200).json({
    success: true,
    data: {
      savedServices: user.savedServices
    }
  });
});

module.exports = {
  getUserProfile,
  updatePersona,
  getSavedServices
};
