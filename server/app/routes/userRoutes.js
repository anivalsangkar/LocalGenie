const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const {
  getUserProfile,
  updatePersona,
  getSavedServices
} = require('../controllers/userController');

// Protected routes (require authentication)
router.use(verifyToken);

router.route('/profile')
  .get(getUserProfile);

router.route('/persona')
  .put(updatePersona);

router.route('/saved')
  .get(getSavedServices);

module.exports = router;
