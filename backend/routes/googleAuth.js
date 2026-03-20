// ─────────────────────────────────────────────
//  routes/googleAuth.js  –  Google OAuth Route
// ─────────────────────────────────────────────
const express      = require('express');
const passport     = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User         = require('../models/User');
const generateToken = require('../utils/generateToken');

const router = express.Router();

// ── Configure Google Strategy ──
passport.use(new GoogleStrategy({
  clientID:     process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL:  process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user already exists
    let user = await User.findOne({ googleId: profile.id });

    if (user) {
      // Existing user — update lastLogin
      await user.updateOne({ lastLogin: new Date() });
      return done(null, user);
    }

    // Check if email already registered (with password)
    const emailUser = await User.findOne({ email: profile.emails[0].value });
    if (emailUser) {
      // Link Google to existing account
      await emailUser.updateOne({
        googleId:   profile.id,
        isVerified: true,
        lastLogin:  new Date(),
      });
      return done(null, emailUser);
    }

    // Create new user from Google profile
    user = await User.create({
      googleId:   profile.id,
      name:       profile.displayName,
      email:      profile.emails[0].value,
      avatar:     profile.photos[0]?.value,
      isVerified: true,   // Google already verified email
      role:       'user',
    });

    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// ── Routes ──

// Step 1: Redirect to Google
router.get('/', passport.authenticate('google', {
  scope: ['profile', 'email'],
}));

// Step 2: Google callback
router.get('/callback',
  passport.authenticate('google', { failureRedirect: '/login.html?error=google_failed' }),
  async (req, res) => {
    try {
      const token = generateToken(req.user._id, req.user.role);
      const FRONTEND = process.env.FRONTEND_URL || 'http://127.0.0.1:5500';

      // Redirect to frontend with token
      // Frontend will read token from URL and store in localStorage
      res.redirect(`${FRONTEND}/index.html?token=${token}&name=${encodeURIComponent(req.user.name)}`);
    } catch (err) {
      res.redirect('/login.html?error=server_error');
    }
  }
);

module.exports = { router, passport };
