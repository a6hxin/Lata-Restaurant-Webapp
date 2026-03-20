// ─────────────────────────────────────────────
//  routes/menu.js  –  Menu Routes
//  GET  /api/menu              – Get all items (with filters)
//  GET  /api/menu/:id          – Get single item
//  POST /api/menu              – Add item (admin)
//  PUT  /api/menu/:id          – Update item (admin)
//  DELETE /api/menu/:id        – Delete item (admin)
// ─────────────────────────────────────────────
const express  = require('express');
const MenuItem = require('../models/MenuItem');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

/* ──────────────────────────────────────────
   GET /api/menu
   Query: category, isVeg, minPrice, maxPrice,
          minRating, search, sort, page, limit
─────────────────────────────────────────── */
router.get('/', async (req, res, next) => {
  try {
    const {
      category, isVeg, minPrice, maxPrice,
      minRating, search, sort,
      page  = 1,
      limit = 50,
    } = req.query;

    const filter = { isAvailable: true };

    if (category)  filter.category  = category;
    if (isVeg === 'true') filter.isVeg = true;

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (minRating) filter['rating.average'] = { $gte: Number(minRating) };

    // Text search
    if (search) {
      filter.$text = { $search: search };
    }

    // Sort options
    const sortMap = {
      'price-asc':    { price: 1 },
      'price-desc':   { price: -1 },
      'rating-desc':  { 'rating.average': -1 },
      'name-asc':     { name: 1 },
      'popular':      { isPopular: -1, 'rating.average': -1 },
      'default':      { category: 1, isPopular: -1 },
    };
    const sortQuery = sortMap[sort] || sortMap['default'];

    const skip  = (Number(page) - 1) * Number(limit);
    const total = await MenuItem.countDocuments(filter);
    const items = await MenuItem.find(filter)
      .sort(sortQuery)
      .skip(skip)
      .limit(Number(limit));

    res.json({
      success: true,
      total,
      page:    Number(page),
      pages:   Math.ceil(total / Number(limit)),
      items,
    });
  } catch (err) { next(err); }
});

/* ──────────────────────────────────────────
   GET /api/menu/:id
─────────────────────────────────────────── */
router.get('/:id', async (req, res, next) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item)
      return res.status(404).json({ success: false, message: 'Menu item not found.' });
    res.json({ success: true, item });
  } catch (err) { next(err); }
});

/* ──────────────────────────────────────────
   POST /api/menu  [Admin only]
─────────────────────────────────────────── */
router.post('/', protect, adminOnly, async (req, res, next) => {
  try {
    const item = await MenuItem.create(req.body);
    res.status(201).json({ success: true, item });
  } catch (err) { next(err); }
});

/* ──────────────────────────────────────────
   PUT /api/menu/:id  [Admin only]
─────────────────────────────────────────── */
router.put('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const item = await MenuItem.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!item)
      return res.status(404).json({ success: false, message: 'Menu item not found.' });
    res.json({ success: true, item });
  } catch (err) { next(err); }
});

/* ──────────────────────────────────────────
   DELETE /api/menu/:id  [Admin only]
─────────────────────────────────────────── */
router.delete('/:id', protect, adminOnly, async (req, res, next) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);
    if (!item)
      return res.status(404).json({ success: false, message: 'Menu item not found.' });
    res.json({ success: true, message: 'Item deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
