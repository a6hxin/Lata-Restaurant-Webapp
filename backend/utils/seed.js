// ─────────────────────────────────────────────
//  utils/seed.js  –  Seed Menu Items into DB
//  Run: npm run seed
// ─────────────────────────────────────────────
require('dotenv').config();
const mongoose = require('mongoose');
const MenuItem = require('../models/MenuItem');
const User     = require('../models/User');
const bcrypt   = require('bcryptjs');

const MENU_ITEMS = [
  // ── STARTERS ──
  { name:'Paneer Tikka',      category:'starters', price:220, emoji:'🧀', isVeg:true,  isPopular:true,  badges:['Bestseller'], rating:{average:4.8,count:312}, description:'Marinated cottage cheese cubes grilled in tandoor with bell peppers and onions.' },
  { name:'Seekh Kebab',       category:'starters', price:280, emoji:'🍢', isVeg:false, badges:['Spicy'],                        rating:{average:4.5,count:198}, description:'Minced lamb with aromatic herbs and spices, grilled on skewers in tandoor.' },
  { name:'Veg Samosa',        category:'starters', price:80,  emoji:'🥟', isVeg:true,  isJain:true,     badges:['New'],         rating:{average:4.3,count:540}, description:'Crispy fried pastry filled with spiced potatoes and peas.', oldPrice:100 },
  { name:'Chicken Tikka',     category:'starters', price:300, emoji:'🍗', isVeg:false, isPopular:true,  badges:['Bestseller'], rating:{average:4.7,count:275}, description:'Tender chicken pieces marinated overnight in yoghurt and spices, chargrilled.' },
  { name:'Hara Bhara Kebab',  category:'starters', price:160, emoji:'🟢', isVeg:true,  badges:[],                              rating:{average:4.2,count:88},  description:'Crispy spinach and pea patties with green chutney. Light and delicious.' },
  { name:'Fish Amritsari',    category:'starters', price:320, emoji:'🐟', isVeg:false, badges:['Spicy'],                        rating:{average:4.6,count:142}, description:'Crispy batter-fried fish with carom seeds and chaat masala. A Punjabi classic.' },

  // ── MAINS ──
  { name:'Dal Makhani',          category:'mains', price:220, emoji:'🍲', isVeg:true,  isPopular:true,  badges:['Bestseller'], rating:{average:4.9,count:621}, description:'Slow-cooked black lentils with butter and cream, simmered overnight for rich flavour.' },
  { name:'Paneer Butter Masala', category:'mains', price:260, emoji:'🧀', isVeg:true,  badges:['Bestseller'],                  rating:{average:4.7,count:408}, description:'Velvety tomato-cashew gravy with soft paneer cubes. Crown jewel of Indian veg cuisine.' },
  { name:'Butter Chicken',       category:'mains', price:320, emoji:'🍗', isVeg:false, isPopular:true,  badges:['Popular'],    rating:{average:4.8,count:510}, description:"Tender chicken in a rich, mildly spiced tomato-butter sauce. India's most iconic dish." },
  { name:'Palak Paneer',         category:'mains', price:240, emoji:'🥬', isVeg:true,  badges:[],                              rating:{average:4.4,count:210}, description:'Fresh spinach purée with soft paneer cubes, tempered with garlic and spices.' },
  { name:'Mutton Rogan Josh',    category:'mains', price:380, emoji:'🥘', isVeg:false, badges:['Spicy'],                        rating:{average:4.7,count:187}, description:'Kashmiri-style slow-braised mutton in aromatic whole spices.' },
  { name:'Chole Masala',         category:'mains', price:180, emoji:'🫘', isVeg:true,  isJain:true,     badges:['Jain Ok'],    rating:{average:4.3,count:163}, description:'Spiced chickpea curry with tangy tomatoes and dried pomegranate seeds.' },
  { name:'Shahi Paneer',         category:'mains', price:280, emoji:'🍛', isVeg:true,  badges:[],                              rating:{average:4.5,count:231}, description:'Royal Mughal-style paneer in a rich cream and cashew-based sauce.' },
  { name:'Chicken Korma',        category:'mains', price:340, emoji:'🍗', isVeg:false, badges:[],                              rating:{average:4.6,count:144}, description:'Tender chicken in a luxurious almond and coconut milk-based korma sauce.' },

  // ── BREADS ──
  { name:'Butter Naan',    category:'breads', price:50,  emoji:'🫓', isVeg:true, isPopular:true, badges:['Must Try'], rating:{average:4.8,count:890}, description:'Soft leavened bread baked in tandoor, generously brushed with butter.' },
  { name:'Garlic Naan',    category:'breads', price:60,  emoji:'🫓', isVeg:true, badges:[],                          rating:{average:4.7,count:642}, description:'Fluffy naan topped with fresh garlic and coriander, baked in clay oven.' },
  { name:'Laccha Paratha', category:'breads', price:55,  emoji:'🥙', isVeg:true, isJain:true, badges:['Jain Ok'],    rating:{average:4.5,count:320}, description:'Multi-layered whole wheat flatbread with crispy outside and flaky inside.' },
  { name:'Peshwari Naan',  category:'breads', price:90,  emoji:'🫓', isVeg:true, badges:['New'],                     rating:{average:4.4,count:108}, description:'Sweet naan stuffed with coconut, almonds and raisins.' },

  // ── RICE ──
  { name:'Veg Dum Biryani',   category:'rice', price:280, emoji:'🍚', isVeg:true,  isPopular:true, badges:['Bestseller'], rating:{average:4.7,count:445}, description:'Fragrant basmati rice layered with spiced vegetables, slow-cooked dum style.' },
  { name:'Chicken Biryani',   category:'rice', price:350, emoji:'🍗', isVeg:false, isPopular:true, badges:['Bestseller'], rating:{average:4.9,count:712}, description:'Premium basmati rice layered with marinated chicken and saffron.' },
  { name:'Jeera Rice',        category:'rice', price:120, emoji:'🍚', isVeg:true,  isJain:true,    badges:['Jain Ok'],    rating:{average:4.2,count:187}, description:'Light steamed basmati rice tempered with cumin seeds and ghee.' },

  // ── DESSERTS ──
  { name:'Gulab Jamun',   category:'desserts', price:120, emoji:'🍮', isVeg:true, isPopular:true, badges:['Bestseller'], rating:{average:4.9,count:560}, description:'Soft milk-solid dumplings soaked in rose-saffron syrup.' },
  { name:'Kulfi Falooda', category:'desserts', price:150, emoji:'🍦', isVeg:true, badges:['Seasonal'],                   rating:{average:4.6,count:198}, description:'Traditional Indian ice cream with rose syrup, basil seeds and vermicelli.' },
  { name:'Gajar Ka Halwa',category:'desserts', price:130, emoji:'🥕', isVeg:true, badges:[],                             rating:{average:4.5,count:215}, description:'Slow-cooked carrot pudding with ghee, milk and nuts.' },

  // ── DRINKS ──
  { name:'Mango Lassi',   category:'drinks', price:90,  emoji:'🥭', isVeg:true, isPopular:true, badges:['Bestseller'], rating:{average:4.8,count:480}, description:'Thick creamy yoghurt blended with Alphonso mango pulp and cardamom.' },
  { name:'Masala Chaas',  category:'drinks', price:60,  emoji:'🥛', isVeg:true, isJain:true,    badges:['Jain Ok'],    rating:{average:4.4,count:312}, description:'Spiced buttermilk with roasted cumin, mint and ginger.' },
  { name:'Rose Sharbat',  category:'drinks', price:70,  emoji:'🌹', isVeg:true, badges:['New'],                        rating:{average:4.3,count:95},  description:'Chilled rose-flavoured drink with basil seeds and a hint of lemon.' },
  { name:'Masala Chai',   category:'drinks', price:50,  emoji:'☕', isVeg:true, badges:[],                             rating:{average:4.6,count:410}, description:'Freshly brewed spiced tea with ginger, cardamom, cloves and cinnamon.' },
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // ── Seed Menu Items ──
    await MenuItem.deleteMany({});
    const items = await MenuItem.insertMany(MENU_ITEMS);
    console.log(`✅ Seeded ${items.length} menu items`);

    // ── Seed Admin User ──
    const existing = await User.findOne({ email: 'admin@lata.com' });
    if (!existing) {
      const passwordHash = await bcrypt.hash('Admin@1234', 12);
      await User.create({
        name:         'Lata Admin',
        email:        'admin@lata.com',
        passwordHash,
        role:         'admin',
        isVerified:   true,
        loyaltyPoints:0,
      });
      console.log('✅ Admin user created: admin@lata.com / Admin@1234');
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    // ── Seed Demo User ──
    const demoExists = await User.findOne({ email: 'test@lata.com' });
    if (!demoExists) {
      const passwordHash = await bcrypt.hash('Test@1234', 12);
      await User.create({
        name:          'Priya Sharma',
        email:         'test@lata.com',
        phone:         '9876543210',
        passwordHash,
        role:          'user',
        isVerified:    true,
        loyaltyPoints: 650,
        foodPreference:'Vegetarian',
        address:       '42, Civil Lines, Nagpur',
        city:          'Nagpur',
      });
      console.log('✅ Demo user created: test@lata.com / Test@1234');
    } else {
      console.log('ℹ️  Demo user already exists');
    }

    console.log('\n🎉 Database seeded successfully!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
