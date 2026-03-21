// ─────────────────────────────────────────────
//  models/MenuItem.js  –  Menu Item Schema
// ─────────────────────────────────────────────
const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  description: { type: String, required: true, maxlength: 500 },
  category:    {
    type: String,
    required: true,
    enum: ['starters','mains','breads','rice','desserts','drinks'],
  },
  price:       { type: Number, required: true, min: 0 },
  oldPrice:    { type: Number },              // for showing strikethrough price
  emoji:       { type: String, default: '🍽️' },
  image:       { type: String },              // URL or base64
  isVeg:       { type: Boolean, default: true },
  isJain:      { type: Boolean, default: false },
  isAvailable: { type: Boolean, default: true },
  isPopular:   { type: Boolean, default: false },
  isFeatured:  { type: Boolean, default: false },
  badges:      [{ type: String }],            // ['Bestseller','New','Spicy']
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count:   { type: Number, default: 0 },
  },
  spiceLevel:  { type: Number, default: 0, min: 0, max: 3 }, // 0=mild,1=medium,2=hot,3=extra hot
  prepTime:    { type: Number, default: 20 },   // minutes
  tags:        [{ type: String }],
}, { timestamps: true });

// Index for fast category + availability queries
menuItemSchema.index({ category: 1, isAvailable: 1 });
menuItemSchema.index({ name: 'text', description: 'text' }); // text search

module.exports = mongoose.model('MenuItem', menuItemSchema);
