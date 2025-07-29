const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');

router.get('/dashboard', verifyToken, (req, res) => {
  res.json({
    message: 'Welcome to the protected dashboard!',
    user: req.user,
    secretData: 'Restricted data, for authorized users only.',
  });
});

module.exports = router;
