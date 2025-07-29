const express = require('express')
const router = express.Router()
const { createAccountUser, signupUser } = require('../controllers/authController')

router.post('/register', createAccountUser)
router.post('/signup', signupUser)

module.exports = router