// ─────────────────────────────────────────────
//  utils/generateToken.js  –  JWT Helper
// ─────────────────────────────────────────────
const jwt = require('jsonwebtoken');

/**
 * Generate a signed JWT token
 * @param {string} userId  - MongoDB user _id
 * @param {string} role    - 'user' | 'admin'
 * @returns {string}       - Signed JWT
 */
const generateToken = (userId, role = 'user') => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

module.exports = generateToken;
