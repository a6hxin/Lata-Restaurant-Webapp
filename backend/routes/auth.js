// ─────────────────────────────────────────────
//  routes/auth.js  –  Auth Routes
//  OTP verification removed — not needed
// ─────────────────────────────────────────────
const express   = require('express');
const bcrypt    = require('bcryptjs');
const validator = require('validator');
const User      = require('../models/User');
const { protect }   = require('../middleware/auth');
const generateToken = require('../utils/generateToken');

const router = express.Router();

/* ──────────────────────────────────────────
   POST /api/auth/signup
   Body: { name, email, phone, password }
─────────────────────────────────────────── */
router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });

    if (!validator.isEmail(email))
      return res.status(400).json({ success: false, message: 'Invalid email address.' });

    if (password.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });

    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password))
      return res.status(400).json({ success: false, message: 'Password must have at least one uppercase letter and one number.' });

    if (phone && !validator.isMobilePhone(phone.replace(/\s/g,''), 'en-IN'))
      return res.status(400).json({ success: false, message: 'Invalid Indian mobile number.' });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });

    const passwordHash = await bcrypt.hash(password, 12);

    // ✅ isVerified: true — no OTP needed
    const user = await User.create({
      name:         validator.escape(name.trim()),
      email:        email.toLowerCase(),
      phone:        phone?.replace(/\s/g,''),
      passwordHash,
      isVerified:   true,
    });

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      message: 'Account created successfully! Welcome to Lata Family Restaurant.',
      token,
      user: user.toSafeObject(),
    });
  } catch (err) { next(err); }
});

/* ──────────────────────────────────────────
   POST /api/auth/login
   Body: { email, password }
─────────────────────────────────────────── */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required.' });

    if (!validator.isEmail(email))
      return res.status(400).json({ success: false, message: 'Invalid email address.' });

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user || !user.passwordHash)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    // ── Account locked? ──
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const mins = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Account locked. Try again in ${mins} minute${mins > 1 ? 's' : ''}.`,
      });
    }

    // ── Check password ──
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      await user.incrementLoginAttempts();
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // ✅ No isVerified check — login directly
    await user.updateOne({
      $set:   { loginAttempts: 0, lastLogin: new Date() },
      $unset: { lockUntil: 1 },
    });

    const token = generateToken(user._id, user.role);

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: user.toSafeObject(),
    });
  } catch (err) { next(err); }
});

/* ──────────────────────────────────────────
   GET /api/auth/profile  [Protected]
─────────────────────────────────────────── */
router.get('/profile', protect, async (req, res) => {
  res.json({ success: true, user: req.user.toSafeObject() });
});

/* ──────────────────────────────────────────
   PUT /api/auth/profile  [Protected]
─────────────────────────────────────────── */
router.put('/profile', protect, async (req, res, next) => {
  try {
    const { name, phone, dob, foodPreference, address, city } = req.body;
    const updates = {};

    if (name)  updates.name = validator.escape(name.trim()).slice(0, 60);

    if (phone) {
      const cleaned = phone.replace(/\s/g,'');
      if (!validator.isMobilePhone(cleaned, 'en-IN'))
        return res.status(400).json({ success: false, message: 'Invalid phone number.' });
      updates.phone = cleaned;
    }

    if (dob) {
      const y = parseInt(dob.year);
      if (dob.year && (y < 1900 || y > new Date().getFullYear()))
        return res.status(400).json({ success: false, message: 'Invalid birth year.' });
      updates.dob = dob;
    }

    const allowedPrefs = ['Vegetarian','Non-Vegetarian','Vegan','Jain','No preference'];
    if (foodPreference && allowedPrefs.includes(foodPreference))
      updates.foodPreference = foodPreference;

    if (address) updates.address = validator.escape(address.trim()).slice(0, 300);
    if (city)    updates.city    = validator.escape(city.trim());

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ success: true, user: user.toSafeObject() });
  } catch (err) { next(err); }
});

/* ──────────────────────────────────────────
   POST /api/auth/logout  [Protected]
─────────────────────────────────────────── */
router.post('/logout', protect, (req, res) => {
  res.json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;
