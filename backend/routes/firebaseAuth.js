// ─────────────────────────────────────────────
//  routes/firebaseAuth.js
//  POST /api/auth/google-firebase
//  Uses firebase-admin SDK to verify tokens
// ─────────────────────────────────────────────
const express = require('express');
const admin   = require('firebase-admin');
const User    = require('../models/User');
const generateToken = require('../utils/generateToken');

const router = express.Router();

// ── Initialize Firebase Admin (only once) ──
if (!admin.apps.length) {
  try {
    const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT || './serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin initialized');
  } catch (err) {
    console.error('❌ Firebase Admin init failed:', err.message);
    console.error('   Make sure serviceAccountKey.json is in backend/ folder');
  }
}

/* ──────────────────────────────────────────
   POST /api/auth/google-firebase
   Body: { firebaseToken }
─────────────────────────────────────────── */
router.post('/google-firebase', async (req, res, next) => {
  try {
    const { firebaseToken } = req.body;

    if (!firebaseToken) {
      return res.status(400).json({
        success: false,
        message: 'Firebase token is required.',
      });
    }

    // ── Verify token using Firebase Admin SDK ──
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(firebaseToken);
    } catch (err) {
      console.error('Token verification failed:', err.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired Google token. Please try again.',
      });
    }

    const { email, name, picture, uid: googleId } = decoded;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Could not get email from Google account.',
      });
    }

    // ── Find or Create user in MongoDB ──
    let user = await User.findOne({
      $or: [{ googleId }, { email: email.toLowerCase() }],
    });

    if (user) {
      await user.updateOne({
        googleId,
        isVerified: true,
        lastLogin:  new Date(),
        avatar:     picture || user.avatar,
      });
      user = await User.findById(user._id);
    } else {
      user = await User.create({
        googleId,
        name:          name || email.split('@')[0],
        email:         email.toLowerCase(),
        avatar:        picture,
        isVerified:    true,
        role:          'user',
        loyaltyPoints: 0,
      });
      console.log('✅ New Google user created:', email);
    }

    const token = generateToken(user._id, user.role);

    res.json({
      success: true,
      message: 'Google sign-in successful!',
      token,
      user: user.toSafeObject(),
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
