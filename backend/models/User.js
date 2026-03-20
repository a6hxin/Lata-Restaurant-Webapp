// ─────────────────────────────────────────────
//  models/User.js  –  User Schema
// ─────────────────────────────────────────────
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:          { type: String, trim: true, maxlength: 60 },
  email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone:         { type: String, trim: true },
  passwordHash:  { type: String },           // null for Google OAuth users
  googleId:      { type: String },

  // Profile
  avatar:        { type: String },
  dob:           { day: String, month: String, year: String },
  foodPreference:{ type: String, enum: ['Vegetarian','Non-Vegetarian','Vegan','Jain','No preference'] },
  address:       { type: String, maxlength: 300 },
  city:          { type: String, default: 'Nagpur' },

  // Account status
  role:          { type: String, enum: ['user','admin'], default: 'user' },
  isVerified:    { type: Boolean, default: false },

  // OTP
  otp:           { type: String },
  otpExpiry:     { type: Date },

  // Security – account lockout
  loginAttempts: { type: Number, default: 0 },
  lockUntil:     { type: Date },

  // Loyalty points
  loyaltyPoints: { type: Number, default: 0 },

  // Timestamps
  lastLogin:     { type: Date },
}, { timestamps: true });

// ── Virtual: is account locked? ──
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// ── Increment failed login attempts ──
userSchema.methods.incrementLoginAttempts = async function () {
  // If previous lock expired, reset
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set:   { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }
  const update = { $inc: { loginAttempts: 1 } };
  // Lock after 5 failed attempts for 30 minutes
  if (this.loginAttempts + 1 >= 5) {
    update.$set = { lockUntil: Date.now() + 30 * 60 * 1000 };
  }
  return this.updateOne(update);
};

// ── Safe object – never expose sensitive fields ──
userSchema.methods.toSafeObject = function () {
  return {
    id:            this._id,
    name:          this.name,
    email:         this.email,
    phone:         this.phone,
    avatar:        this.avatar,
    dob:           this.dob,
    foodPreference:this.foodPreference,
    address:       this.address,
    city:          this.city,
    role:          this.role,
    isVerified:    this.isVerified,
    loyaltyPoints: this.loyaltyPoints,
    createdAt:     this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
