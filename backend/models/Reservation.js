// ─────────────────────────────────────────────
//  models/Reservation.js  –  Table Reservation
// ─────────────────────────────────────────────
const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  user:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:      { type: String, required: true, trim: true },
  phone:     { type: String, required: true, trim: true },
  email:     { type: String, trim: true, lowercase: true },

  date:      { type: Date, required: true },
  time:      { type: String, required: true },      // "19:30"
  guests:    { type: Number, required: true, min: 1, max: 20 },
  occasion:  { type: String },                      // Birthday, Anniversary…
  notes:     { type: String, maxlength: 300 },      // special requests

  status: {
    type: String,
    enum: ['pending','confirmed','completed','cancelled','no-show'],
    default: 'pending',
  },

  // Admin confirmation note
  confirmationNote: { type: String },

  // Table assigned by admin
  tableNumber: { type: Number },

}, { timestamps: true });

reservationSchema.index({ user: 1, date: -1 });
reservationSchema.index({ date: 1, status: 1 });

module.exports = mongoose.model('Reservation', reservationSchema);
