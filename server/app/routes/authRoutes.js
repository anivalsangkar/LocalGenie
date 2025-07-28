const express = require('express')
const router = express.Router()
const { createAccountUser } = require('../controllers/authController')

router.post('/register', createAccountUser)
module.exports = router