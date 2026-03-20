// ─────────────────────────────────────────────
//  config/db.js  –  MongoDB Connection
// ─────────────────────────────────────────────
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // These options are good practice for stable connections
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS:          45000,
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on('error', err => {
      console.error('❌ MongoDB error:', err.message);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB disconnected. Retrying…');
    });

  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1); // Stop server if DB not available
  }
};

module.exports = connectDB;
