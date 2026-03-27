// ─────────────────────────────────────────────
//  middleware/auth.js  –  Authentication Middleware
// ─────────────────────────────────────────────
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware to protect routes – ensures user is authenticated
 */
exports.protect = async (req, res, next) => {
  let token;

  // 1. Check for token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, token failed or missing.' });
  }

  try {
    // 2. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Find user and attach to req.user (exclude sensitive fields)
    const user = await User.findById(decoded.id).select('-passwordHash -otp -otpExpiry');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User belonging to this token no longer exists.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ success: false, message: 'Not authorized, invalid token.' });
  }
};

/**
 * Middleware to restrict access to admin only
 */
exports.adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Not authorized as an admin.' });
  }
};
