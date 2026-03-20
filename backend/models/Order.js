// ─────────────────────────────────────────────
//  models/Order.js  –  Order Schema
// ─────────────────────────────────────────────
const mongoose = require('mongoose');

// Sub-schema for each ordered item
const orderItemSchema = new mongoose.Schema({
  menuItem:   { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: true },
  name:       { type: String, required: true },   // snapshot at time of order
  price:      { type: Number, required: true },
  quantity:   { type: Number, required: true, min: 1 },
  emoji:      { type: String },
  isVeg:      { type: Boolean },
}, { _id: false });

// Status history entry
const statusHistorySchema = new mongoose.Schema({
  status:    { type: String },
  message:   { type: String },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderId:    {
    type: String,
    unique: true,
    default: () => '#LFR-' + Math.floor(1000 + Math.random() * 9000),
  },

  user:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  items:      [orderItemSchema],

  // Pricing
  subtotal:   { type: Number, required: true },
  tax:        { type: Number, default: 0 },
  deliveryCharge: { type: Number, default: 0 },
  discount:   { type: Number, default: 0 },
  couponCode: { type: String },
  total:      { type: Number, required: true },

  // Order type
  orderType:  {
    type: String,
    enum: ['dine-in','takeaway','delivery'],
    default: 'dine-in',
  },

  // Delivery details (only for delivery orders)
  deliveryAddress: {
    name:    String,
    phone:   String,
    flat:    String,
    area:    String,
    city:    { type: String, default: 'Nagpur' },
    pincode: String,
    instructions: String,
  },

  // Payment
  paymentMethod: {
    type: String,
    enum: ['upi','card','netbanking','cod'],
    default: 'cod',
  },
  paymentStatus: {
    type: String,
    enum: ['pending','paid','failed','refunded'],
    default: 'pending',
  },
  transactionId: { type: String },

  // Order status — the main tracking field
  status: {
    type: String,
    enum: [
      'placed',       // 0 – order received
      'confirmed',    // 1 – restaurant accepted
      'preparing',    // 2 – kitchen cooking
      'ready',        // 3 – food packed
      'picked',       // 4 – rider picked up (delivery)
      'delivered',    // 5 – delivered
      'cancelled',    // X – cancelled
    ],
    default: 'placed',
  },

  // Full history of status changes with timestamps
  statusHistory: [statusHistorySchema],

  // Delivery partner info
  deliveryPartner: {
    name:   String,
    phone:  String,
    rating: Number,
  },

  // Estimated time in minutes
  estimatedTime: { type: Number, default: 30 },

  // Special instructions from customer
  specialInstructions: { type: String, maxlength: 300 },

  // Rating given after delivery
  rating:  { type: Number, min: 1, max: 5 },
  review:  { type: String, maxlength: 500 },

  // Cancellation
  cancelledAt:  { type: Date },
  cancelReason: { type: String },

}, { timestamps: true });

// Index for fast user order lookups
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ orderId: 1 });

// Pre-save: push status change to history
orderSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    const messages = {
      placed:    'Your order has been received.',
      confirmed: 'Restaurant has confirmed your order.',
      preparing: 'Our chefs are preparing your food.',
      ready:     'Your order is packed and ready!',
      picked:    'Delivery partner has picked up your order.',
      delivered: 'Order delivered successfully. Enjoy!',
      cancelled: 'Order has been cancelled.',
    };
    this.statusHistory.push({
      status:    this.status,
      message:   messages[this.status] || '',
      timestamp: new Date(),
    });
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
