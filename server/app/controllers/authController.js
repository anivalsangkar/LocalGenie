const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
require('dotenv').config()

exports.createAcountUser = async(req, res) => {
    try {
        const { name, email, password } = req.body

        if (!name || !email || !password ) {
            return res.status(400).json({ message: 'All fields are required.' })
        }

        const existingUser = await User.findOne({ email })
        if (existingUser) {
            return res.status(409).json({ message: 'Email already registered.' })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const newUser = new User({name, email, password: hashedPassword})
        await newUser.save()
        res.status(201).json({ message: 'User created successfully.' })
    } catch (error) {
        console.error('Registration Error:', error)
        res.status(500).json({ message: 'Server error.' })
    }
};

exports.signupUser = async (req, res) => {
    try {
        const { email, password } = req.body

        // Validate credentials
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and Password are required.' })
        }

        // Find user by email
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' })
        }

        // Compare password with hashed one
        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials.' })
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET || 'your_jwt_secret',
            { expiresIn: '1h' }
        )

        // Return token & user data (excluding password)
        const { password: _, ...userData } = user.toObject()
        res.status(200).json({ token, user: userData })
    } catch (error) {
        console.error('Login Error:', error)
        res.status(500).json({ message: 'Server error.' })
    }
}