// ============================================================
//  Lata Family Restaurant – Auth Backend
//  File: backend/server.js
//  Stack: Node.js + Express + MongoDB (Mongoose) + JWT
//  Run:  npm install && node server.js
// ============================================================
import { initializeApp } from "firebase/app";
const express    = require('express');
const mongoose   = require('mongoose');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const helmet     = require('helmet');
const validator  = require('validator');
const nodemailer = require('nodemailer');
require('dotenv').config();
// ── Security Middleware ──────────────────────────────────────
app.use(helmet());                          // sets secure HTTP headers
app.use(express.json({ limit: '10kb' }));   // limit body size (prevent DOS)
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiter – max 10 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── MongoDB Connection ───────────────────────────────────────
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/lata_restaurant')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => { console.error('❌ MongoDB error:', err.message); process.exit(1); });

// ── User Schema ──────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  name:         { type: String, trim: true, maxlength: 60 },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:        { type: String, trim: true },
  passwordHash: { type: String },                // null for Google users
  googleId:     { type: String },
  avatar:       { type: String },
  isVerified:   { type: Boolean, default: false },
  otp:          { type: String },
  otpExpiry:    { type: Date },
  loginAttempts:{ type: Number, default: 0 },
  lockUntil:    { type: Date },
  role:         { type: String, enum: ['user','admin'], default: 'user' },
  createdAt:    { type: Date, default: Date.now },
  lastLogin:    { type: Date },
}, { timestamps: true });

// Never return sensitive fields
userSchema.methods.toSafeObject = function() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    avatar: this.avatar,
    isVerified: this.isVerified,
    role: this.role,
  };
};

// Account lockout logic
userSchema.methods.isLocked = function() {
  return this.lockUntil && this.lockUntil > Date.now();
};

userSchema.methods.incrementLoginAttempts = async function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    // Reset if lock expired
    return this.updateOne({ $set: { loginAttempts: 1 }, $unset: { lockUntil: 1 } });
  }
  const update = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= 5) {
    update.$set = { lockUntil: Date.now() + 30 * 60 * 1000 }; // lock 30 min
  }
  return this.updateOne(update);
};

const User = mongoose.model('User', userSchema);

// ── Helpers ──────────────────────────────────────────────────
function generateToken(userId, role) {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET || 'CHANGE_THIS_SECRET_IN_ENV',
    { expiresIn: '7d' }
  );
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
}
function googleLogin() {
  signInWithPopup(auth, provider)
    .then((result) => {
      const user = result.user;
      console.log(user);
      alert("Welcome " + user.displayName);
    })
    .catch((error) => {
      console.log(error);
    });
}
// Send OTP via email (configure SMTP in .env)
async function sendOTPEmail(email, otp, name) {
  const transporter = nodemailer.createTransporter({
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from:    `"Lata Family Restaurant" <${process.env.SMTP_USER}>`,
    to:      email,
    subject: 'Your OTP – Lata Family Restaurant',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#FDF6EE;border-radius:12px;">
        <h2 style="color:#7B2D00;font-family:Georgia,serif;">Lata Family Restaurant 🪔</h2>
        <p>Hello <strong>${name || 'there'}</strong>,</p>
        <p>Your One-Time Password (OTP) for verification is:</p>
        <div style="font-size:36px;font-weight:700;color:#E8821A;letter-spacing:8px;text-align:center;padding:16px;background:#fff;border-radius:8px;border:1px solid #E2C9A8;">
          ${otp}
        </div>
        <p style="margin-top:16px;font-size:13px;color:#7A5C44;">
          This OTP expires in <strong>10 minutes</strong>. Do not share it with anyone.
        </p>
        <hr style="border:none;border-top:1px solid #E2C9A8;margin:20px 0;"/>
        <p style="font-size:12px;color:#aaa;">If you did not request this, please ignore this email.</p>
      </div>
    `,
  });
}

// ── Middleware: Authenticate JWT ─────────────────────────────
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided.' });
  }
  try {
    const token = authHeader.split(' ')[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'CHANGE_THIS_SECRET_IN_ENV');
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

// ── ROUTES ───────────────────────────────────────────────────

// ① SIGNUP
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Input validation
    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });

    if (!validator.isEmail(email))
      return res.status(400).json({ success: false, message: 'Invalid email address.' });

    if (password.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });

    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password))
      return res.status(400).json({ success: false, message: 'Password must have at least one uppercase letter and one number.' });

    if (phone && !validator.isMobilePhone(phone, 'en-IN'))
      return res.status(400).json({ success: false, message: 'Invalid Indian phone number.' });

    // Check duplicate
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate OTP
    const otp      = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    const user = await User.create({
      name: validator.escape(name.trim()),
      email: email.toLowerCase(),
      phone,
      passwordHash,
      otp,
      otpExpiry,
      isVerified: false,
    });

    // Send OTP email
    await sendOTPEmail(user.email, otp, user.name);

    res.status(201).json({
      success: true,
      message: 'Account created! Please check your email for the OTP to verify your account.',
      userId: user._id,
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ② LOGIN
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required.' });

    if (!validator.isEmail(email))
      return res.status(400).json({ success: false, message: 'Invalid email address.' });

    const user = await User.findOne({ email: email.toLowerCase() });

    // Use same message for invalid email/password (prevent user enumeration)
    if (!user || !user.passwordHash)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    // Check account lock
    if (user.isLocked())
      return res.status(423).json({ success: false, message: 'Account locked due to too many failed attempts. Try again in 30 minutes.' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      await user.incrementLoginAttempts();
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!user.isVerified)
      return res.status(403).json({ success: false, message: 'Please verify your email before logging in.' });

    // Reset login attempts on success
    await user.updateOne({ $set: { loginAttempts: 0, lastLogin: new Date() }, $unset: { lockUntil: 1 } });

    const token = generateToken(user._id, user.role);

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: user.toSafeObject(),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ③ VERIFY OTP
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp)
      return res.status(400).json({ success: false, message: 'User ID and OTP are required.' });

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ success: false, message: 'User not found.' });

    if (user.isVerified)
      return res.status(400).json({ success: false, message: 'Account already verified.' });

    if (!user.otp || user.otp !== otp)
      return res.status(400).json({ success: false, message: 'Invalid OTP.' });

    if (user.otpExpiry < new Date())
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });

    await user.updateOne({ $set: { isVerified: true }, $unset: { otp: 1, otpExpiry: 1 } });

    const token = generateToken(user._id, user.role);

    res.json({
      success: true,
      message: 'Email verified successfully! Welcome to Lata Family Restaurant.',
      token,
      user: user.toSafeObject(),
    });
  } catch (err) {
    console.error('OTP error:', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ④ RESEND OTP
app.post('/api/auth/resend-otp', async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (user.isVerified) return res.status(400).json({ success: false, message: 'Already verified.' });

    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.updateOne({ $set: { otp, otpExpiry } });
    await sendOTPEmail(user.email, otp, user.name);

    res.json({ success: true, message: 'A new OTP has been sent to your email.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ⑤ GET PROFILE (protected)
app.get('/api/auth/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ⑥ UPDATE PROFILE (protected)
app.put('/api/auth/profile', authenticate, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const updates = {};
    if (name)  updates.name  = validator.escape(name.trim());
    if (phone) {
      if (!validator.isMobilePhone(phone, 'en-IN'))
        return res.status(400).json({ success: false, message: 'Invalid phone number.' });
      updates.phone = phone;
    }
    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true });
    res.json({ success: true, user: user.toSafeObject() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});
app.post('/api/auth/google', async (req, res) => {
  const { email, name, avatar } = req.body;

  let user = await User.findOne({ email });

  if (!user) {
    user = await User.create({
      email,
      name,
      avatar,
      isVerified: true
    });
  }

  const token = generateToken(user._id, user.role);

  res.json({
    success: true,
    token,
    user: user.toSafeObject()
  });
});

// ── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

module.exports = app;
