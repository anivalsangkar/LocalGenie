// createToken.js
const jwt = require('jsonwebtoken');

// Sample user data
const user = {
  id: "123abc",
  email: "madhu@example.com",
};

// Secret key (match with JWT_SECRET in your .env)
const secret = "your_jwt_secret";

// Generate token
const token = jwt.sign(user, secret, { expiresIn: "1h" });

console.log("JWT Token:", token);
