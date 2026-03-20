// ═══════════════════════════════════════════════
//  Lata Family Restaurant – Main Server
//  File: backend/server.js
//  Run:  npm run dev
// ═══════════════════════════════════════════════
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const connectDB     = require('./config/db');
const errorHandler  = require('./middleware/errorHandler');

// ── Route imports ──
const authRoutes         = require('./routes/auth');
const menuRoutes         = require('./routes/menu');
const orderRoutes        = require('./routes/orders');
const reservationRoutes  = require('./routes/reservations');
const firebaseAuthRoutes = require('./routes/firebaseAuth');

const app = express();

// ── Connect to MongoDB ──
connectDB();

// ── Security Middleware ──
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── CORS ──
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://127.0.0.1:5500',
  credentials: true,
  methods:     ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
}));

// ── Logger ──
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// ── Global Rate Limiter ──
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      100,
  message:  { success: false, message: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders:   false,
});
app.use('/api', globalLimiter);

// ── Auth Rate Limiter ──
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  message:  { success: false, message: 'Too many attempts. Wait 15 minutes.' },
});
app.use('/api/auth/login',      authLimiter);
app.use('/api/auth/signup',     authLimiter);
app.use('/api/auth/resend-otp', authLimiter);

// ── Health Check ──
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🪔 Lata Family Restaurant API is running!',
    version: '1.0.0',
  });
});

// ── Routes ──
app.use('/api/auth',         authRoutes);
app.use('/api/auth',         firebaseAuthRoutes);  // Firebase Google Auth
app.use('/api/menu',         menuRoutes);
app.use('/api/orders',       orderRoutes);
app.use('/api/reservations', reservationRoutes);

// ── 404 ──
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// ── Error Handler ──
app.use(errorHandler);

// ── Start ──
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   🪔  Lata Family Restaurant API         ║
  ║   ✅  Running on http://localhost:${PORT}    ║
  ╚══════════════════════════════════════════╝
  `);
});
