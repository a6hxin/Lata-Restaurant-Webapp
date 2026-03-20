// ─────────────────────────────────────────────
//  routes/orders.js  –  Order Routes
//  POST /api/orders              – Place order
//  GET  /api/orders              – My orders
//  GET  /api/orders/:id          – Single order + tracking
//  PATCH /api/orders/:id/status  – Update status (admin)
//  POST /api/orders/:id/cancel   – Cancel order
//  POST /api/orders/:id/rate     – Rate + review
//  GET  /api/orders/admin/all    – All orders (admin)
// ─────────────────────────────────────────────
const express  = require('express');
const Order    = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const User     = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');
const { sendOrderConfirmEmail } = require('../utils/sendOTP');

const router = express.Router();

/* ──────────────────────────────────────────
   POST /api/orders  [Protected]
   Body: { items:[{menuItemId, quantity}],
           orderType, deliveryAddress,
           paymentMethod, couponCode,
           specialInstructions }
─────────────────────────────────────────── */
router.post('/', protect, async (req, res, next) => {
  try {
    const {
      items, orderType = 'dine-in',
      deliveryAddress, paymentMethod = 'cod',
      couponCode, specialInstructions,
    } = req.body;

    if (!items || !items.length)
      return res.status(400).json({ success: false, message: 'Order must have at least one item.' });

    // ── Validate & fetch menu items ──
    const orderItems = [];
    let subtotal = 0;

    for (const { menuItemId, quantity } of items) {
      if (!menuItemId || !quantity || quantity < 1)
        return res.status(400).json({ success: false, message: 'Invalid item or quantity.' });

      const menuItem = await MenuItem.findById(menuItemId);
      if (!menuItem || !menuItem.isAvailable)
        return res.status(400).json({ success: false, message: `${menuItem?.name || 'Item'} is not available.` });

      orderItems.push({
        menuItem: menuItem._id,
        name:     menuItem.name,
        price:    menuItem.price,
        quantity,
        emoji:    menuItem.emoji,
        isVeg:    menuItem.isVeg,
      });
      subtotal += menuItem.price * quantity;
    }

    // ── Delivery charge ──
    const deliveryCharge = orderType === 'delivery' ? 40 : 0;

    // ── Delivery address required for delivery orders ──
    if (orderType === 'delivery' && !deliveryAddress?.flat)
      return res.status(400).json({ success: false, message: 'Delivery address is required for delivery orders.' });

    // ── Tax (5%) ──
    const tax = Math.round(subtotal * 0.05);

    // ── Coupon discount ──
    const COUPONS = { LATA10: 10, WELCOME20: 20, FAMILY15: 15 };
    let discount = 0;
    if (couponCode) {
      const pct = COUPONS[couponCode.toUpperCase()];
      if (pct) discount = Math.round(subtotal * pct / 100);
    }

    const total = subtotal + deliveryCharge + tax - discount;

    // ── Create order ──
    const order = await Order.create({
      user:                req.user._id,
      items:               orderItems,
      subtotal,
      tax,
      deliveryCharge,
      discount,
      couponCode:          couponCode?.toUpperCase(),
      total,
      orderType,
      deliveryAddress:     orderType === 'delivery' ? deliveryAddress : undefined,
      paymentMethod,
      paymentStatus:       paymentMethod === 'cod' ? 'pending' : 'paid',
      specialInstructions,
      estimatedTime:       orderType === 'delivery' ? 45 : 30,
      status:              'placed',
    });

    // ── Award loyalty points (1 pt per ₹10 spent) ──
    const points = Math.floor(total / 10);
    await User.findByIdAndUpdate(req.user._id, { $inc: { loyaltyPoints: points } });

    // ── Send confirmation email (non-blocking) ──
    sendOrderConfirmEmail(req.user.email, {
      orderId:       order.orderId,
      items:         orderItems,
      total,
      estimatedTime: `${order.estimatedTime}–${order.estimatedTime + 10} mins`,
    }).catch(err => console.warn('Email send failed:', err.message));

    res.status(201).json({
      success: true,
      message: 'Order placed successfully!',
      order: {
        _id:           order._id,
        orderId:       order.orderId,
        status:        order.status,
        total:         order.total,
        estimatedTime: order.estimatedTime,
        pointsEarned:  points,
      },
    });
  } catch (err) { next(err); }
});

/* ──────────────────────────────────────────
   GET /api/orders  [Protected]
   Query: status, page, limit
─────────────────────────────────────────── */
router.get('/', protect, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const filter = { user: req.user._id };
    if (status) filter.status = status;

    const skip   = (Number(page) - 1) * Number(limit);
    const total  = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('-statusHistory'); // lean response

    res.json({ success: true, total, page: Number(page), orders });
  } catch (err) { next(err); }
});

/* ──────────────────────────────────────────
   GET /api/orders/:id  [Protected]
   Returns full order with status history
─────────────────────────────────────────── */
router.get('/:id', protect, async (req, res, next) => {
  try {
    const order = await Order.findOne({
      $or: [
        { _id: req.params.id, user: req.user._id },
        { orderId: req.params.id, user: req.user._id },
      ]
    }).populate('items.menuItem', 'name emoji isVeg');

    if (!order)
      return res.status(404).json({ success: false, message: 'Order not found.' });

    res.json({ success: true, order });
  } catch (err) { next(err); }
});

/* ──────────────────────────────────────────
   PATCH /api/orders/:id/status  [Admin only]
   Body: { status }
   This is what powers the live order tracking.
─────────────────────────────────────────── */
router.patch('/:id/status', protect, adminOnly, async (req, res, next) => {
  try {
    const { status, deliveryPartner } = req.body;

    const validStatuses = ['placed','confirmed','preparing','ready','picked','delivered','cancelled'];
    if (!validStatuses.includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status.' });

    const order = await Order.findById(req.params.id);
    if (!order)
      return res.status(404).json({ success: false, message: 'Order not found.' });

    order.status = status;

    // Attach delivery partner when picking up
    if (status === 'picked' && deliveryPartner) {
      order.deliveryPartner = deliveryPartner;
    }

    await order.save(); // triggers pre-save to add statusHistory

    res.json({
      success: true,
      message: `Order status updated to '${status}'.`,
      order:   { _id: order._id, orderId: order.orderId, status: order.status, statusHistory: order.statusHistory },
    });
  } catch (err) { next(err); }
});

/* ──────────────────────────────────────────
   POST /api/orders/:id/cancel  [Protected]
   Can only cancel if status is placed or confirmed
─────────────────────────────────────────── */
router.post('/:id/cancel', protect, async (req, res, next) => {
  try {
    const { reason } = req.body;
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });

    if (!order)
      return res.status(404).json({ success: false, message: 'Order not found.' });

    if (!['placed','confirmed'].includes(order.status))
      return res.status(400).json({ success: false, message: 'Order cannot be cancelled at this stage.' });

    order.status       = 'cancelled';
    order.cancelledAt  = new Date();
    order.cancelReason = reason || 'Cancelled by user';

    // Refund loyalty points
    const points = Math.floor(order.total / 10);
    await User.findByIdAndUpdate(req.user._id, { $inc: { loyaltyPoints: -points } });

    await order.save();

    res.json({ success: true, message: 'Order cancelled successfully.', order });
  } catch (err) { next(err); }
});

/* ──────────────────────────────────────────
   POST /api/orders/:id/rate  [Protected]
   Body: { rating (1-5), review }
─────────────────────────────────────────── */
router.post('/:id/rate', protect, async (req, res, next) => {
  try {
    const { rating, review } = req.body;

    if (!rating || rating < 1 || rating > 5)
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });

    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order)
      return res.status(404).json({ success: false, message: 'Order not found.' });

    if (order.status !== 'delivered')
      return res.status(400).json({ success: false, message: 'Can only rate delivered orders.' });

    if (order.rating)
      return res.status(400).json({ success: false, message: 'Order already rated.' });

    order.rating = rating;
    order.review = review?.slice(0, 500);
    await order.save();

    // Award bonus points for review
    await User.findByIdAndUpdate(req.user._id, { $inc: { loyaltyPoints: 25 } });

    res.json({ success: true, message: 'Thank you for your review! +25 loyalty points added.', order });
  } catch (err) { next(err); }
});

/* ──────────────────────────────────────────
   GET /api/orders/admin/all  [Admin only]
   Query: status, page, limit, date
─────────────────────────────────────────── */
router.get('/admin/all', protect, adminOnly, async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20, date } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (date) {
      const d = new Date(date);
      filter.createdAt = { $gte: d, $lt: new Date(d.getTime() + 86400000) };
    }

    const skip   = (Number(page) - 1) * Number(limit);
    const total  = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('user', 'name email phone');

    res.json({ success: true, total, page: Number(page), orders });
  } catch (err) { next(err); }
});

module.exports = router;
