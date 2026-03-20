// ─────────────────────────────────────────────
//  routes/reservations.js  –  Reservation Routes
//  POST /api/reservations           – Book table
//  GET  /api/reservations           – My reservations
//  GET  /api/reservations/:id       – Single reservation
//  PATCH /api/reservations/:id      – Update (admin confirm/cancel)
//  DELETE /api/reservations/:id     – Cancel by user
//  GET  /api/reservations/admin/all – All reservations (admin)
// ─────────────────────────────────────────────
const express     = require('express');
const validator   = require('validator');
const Reservation = require('../models/Reservation');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

/* ──────────────────────────────────────────
   POST /api/reservations  [Protected]
─────────────────────────────────────────── */
router.post('/', protect, async (req, res, next) => {
  try {
    const { name, phone, email, date, time, guests, occasion, notes } = req.body;

    // ── Validation ──
    if (!name || !phone || !date || !time || !guests)
      return res.status(400).json({ success: false, message: 'Name, phone, date, time and guests are required.' });

    if (!validator.isMobilePhone(phone.replace(/\s/g,''), 'en-IN'))
      return res.status(400).json({ success: false, message: 'Invalid phone number.' });

    const reservDate = new Date(date);
    if (reservDate < new Date())
      return res.status(400).json({ success: false, message: 'Reservation date must be in the future.' });

    if (guests < 1 || guests > 20)
      return res.status(400).json({ success: false, message: 'Guests must be between 1 and 20.' });

    const reservation = await Reservation.create({
      user:     req.user._id,
      name:     validator.escape(name.trim()),
      phone:    phone.replace(/\s/g,''),
      email:    email?.toLowerCase(),
      date:     reservDate,
      time,
      guests:   Number(guests),
      occasion,
      notes:    notes?.slice(0, 300),
      status:   'pending',
    });

    res.status(201).json({
      success: true,
      message: 'Table reserved! We will confirm within 30 minutes.',
      reservation,
    });
  } catch (err) { next(err); }
});

/* ──────────────────────────────────────────
   GET /api/reservations  [Protected]
─────────────────────────────────────────── */
router.get('/', protect, async (req, res, next) => {
  try {
    const reservations = await Reservation
      .find({ user: req.user._id })
      .sort({ date: -1 });

    res.json({ success: true, reservations });
  } catch (err) { next(err); }
});

/* ──────────────────────────────────────────
   GET /api/reservations/:id  [Protected]
─────────────────────────────────────────── */
router.get('/:id', protect, async (req, res, next) => {
  try {
    const reservation = await Reservation.findOne({
      _id:  req.params.id,
      user: req.user._id,
    });

    if (!reservation)
      return res.status(404).json({ success: false, message: 'Reservation not found.' });

    res.json({ success: true, reservation });
  } catch (err) { next(err); }
});

/* ──────────────────────────────────────────
   PATCH /api/reservations/:id  [Admin only]
   Body: { status, confirmationNote, tableNumber }
─────────────────────────────────────────── */
router.patch('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const { status, confirmationNote, tableNumber } = req.body;

    const validStatuses = ['pending','confirmed','completed','cancelled','no-show'];
    if (status && !validStatuses.includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status.' });

    const updates = {};
    if (status)           updates.status           = status;
    if (confirmationNote) updates.confirmationNote = confirmationNote;
    if (tableNumber)      updates.tableNumber      = tableNumber;

    const reservation = await Reservation.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!reservation)
      return res.status(404).json({ success: false, message: 'Reservation not found.' });

    res.json({ success: true, reservation });
  } catch (err) { next(err); }
});

/* ──────────────────────────────────────────
   DELETE /api/reservations/:id  [Protected]
   User can cancel their own reservation
─────────────────────────────────────────── */
router.delete('/:id', protect, async (req, res, next) => {
  try {
    const reservation = await Reservation.findOne({
      _id:  req.params.id,
      user: req.user._id,
    });

    if (!reservation)
      return res.status(404).json({ success: false, message: 'Reservation not found.' });

    if (['completed','cancelled'].includes(reservation.status))
      return res.status(400).json({ success: false, message: 'Cannot cancel this reservation.' });

    reservation.status = 'cancelled';
    await reservation.save();

    res.json({ success: true, message: 'Reservation cancelled.' });
  } catch (err) { next(err); }
});

/* ──────────────────────────────────────────
   GET /api/reservations/admin/all  [Admin]
   Query: date, status, page, limit
─────────────────────────────────────────── */
router.get('/admin/all', protect, adminOnly, async (req, res, next) => {
  try {
    const { date, status, page = 1, limit = 20 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (date) {
      const d = new Date(date);
      filter.date = { $gte: d, $lt: new Date(d.getTime() + 86400000) };
    }

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Reservation.countDocuments(filter);
    const reservations = await Reservation.find(filter)
      .sort({ date: 1, time: 1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('user', 'name email phone');

    res.json({ success: true, total, page: Number(page), reservations });
  } catch (err) { next(err); }
});

module.exports = router;
