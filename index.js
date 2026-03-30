const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ─── ROBUST PATH RESOLUTION ──────────────────────────────
console.log('--- Render Path Diagnostics ---');
console.log('CWD:', process.cwd());
console.log('__dirname:', __dirname);

const searchPaths = [
  path.join(__dirname, 'public'),
  path.join(process.cwd(), 'public'),
  path.resolve('./public'),
  path.join(__dirname, '../public'), // In case it's in a subfolder like 'api'
  '/opt/render/project/src/public', // Common Render path
];

let publicPath = '';
for (const p of searchPaths) {
  if (fs.existsSync(p)) {
    publicPath = p;
    console.log('✅ FOUND public directory at:', publicPath);
    break;
  }
}

if (!publicPath) {
  console.error('❌ ERROR: "public" folder not found! Listing root content...');
  try {
    fs.readdirSync(process.cwd()).forEach(f => console.log(' ->', f));
  } catch(e) {}
  // Default fallback
  publicPath = path.join(__dirname, 'public');
}

const indexPath = path.join(publicPath, 'index.html');
console.log('-> Resolved index.html path:', indexPath);
console.log('-------------------------------');

// ─── MIDDLEWARE & DB ─────────────────────────────────────
app.use(cors());
app.use(express.json());

let cachedDb = null;
async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  return cachedDb = await mongoose.connect(process.env.MONGODB_URI);
}

// ─── MODELS ──────────────────────────────────────────────
const MenuItemSchema = new mongoose.Schema({
  name: String,
  category: String,
  price: Number,
  emoji: String,
  available: { type: Boolean, default: true },
  discount: { type: Number, default: 0 }
});
const MenuItem = mongoose.models.MenuItem || mongoose.model('MenuItem', MenuItemSchema);

const FoodBookingSchema = new mongoose.Schema({
  name: String,
  phone: String,
  address: String,
  km: Number,
  mapUrl: String,
  items: Array,
  subtotal: Number,
  discount: Number,
  delivery: Number,
  total: Number,
  date: { type: Date, default: Date.now }
});
const FoodBooking = mongoose.models.FoodBooking || mongoose.model('FoodBooking', FoodBookingSchema);

const HallBookingSchema = new mongoose.Schema({
  name: String,
  phone: String,
  functionType: String,
  date: String,
  time: String,
  hours: Number,
  members: Number,
  cabin: Number,
  total: Number,
  bookedAt: { type: Date, default: Date.now }
});
const HallBooking = mongoose.models.HallBooking || mongoose.model('HallBooking', HallBookingSchema);

const SettingsSchema = new mongoose.Schema({
  upi: String,
  name: String,
  other: String,
  adminContact: String,
  address: String,
  kmPrices: Array,
  hallPricingMode: String,
  hallPriceAmount: Number,
  foodBookingOpen: { type: Boolean, default: true },
  hallBookingOpen: { type: Boolean, default: true }
});
const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);

// ─── SEED ────────────────────────────────────────────────
async function seedData() {
  try {
    let s = await Settings.findOne();
    if (!s) {
      await Settings.create({
        upi: 'bhaiyarestaurant@upi',
        name: 'Bhaiya Restaurant',
        other: 'Cash accepted at delivery',
        adminContact: '+91 9876543210',
        address: 'Gouda dhepa, down Front of old, Indian gas office, Kavisuryanagar, Boirani, Odisha 761104',
        kmPrices: [
          { upTo: 2, price: 20 },
          { upTo: 5, price: 25 },
          { upTo: 8, price: 30 },
          { upTo: 10, price: 40 },
        ],
        hallPricingMode: 'hour',
        hallPriceAmount: 500,
        foodBookingOpen: true,
        hallBookingOpen: true,
      });
      console.log('✅ Default settings seeded');
    }

    const menuCount = await MenuItem.countDocuments();
    if (menuCount === 0) {
      const defaultMenu = [
        { name: 'Paneer Butter Masala', category: 'Veg Main Course', price: 180, emoji: '🥘', available: true, discount: 5 },
        { name: 'Chicken Biryani', category: 'Non-Veg', price: 220, emoji: '🍗', available: true, discount: 0 },
        { name: 'Butter Naan', category: 'Breads', price: 40, emoji: '🫓', available: true, discount: 0 },
        { name: 'Gulab Jamun', category: 'Desserts', price: 60, emoji: '🍡', available: true, discount: 10 },
        { name: 'Cold Coffee', category: 'Beverages', price: 90, emoji: '🥤', available: true, discount: 0 },
      ];
      await MenuItem.insertMany(defaultMenu);
      console.log('✅ Default menu items seeded');
    }
  } catch (err) {
    console.error('❌ Seeding error:', err);
  }
}

// ─── API ROUTES ──────────────────────────────────────────

// Menu Items
app.get('/api/menu', async (req, res) => {
  try {
    res.json(await MenuItem.find());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/menu', async (req, res) => {
  try {
    res.json(await new MenuItem(req.body).save());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/menu/:id', async (req, res) => {
  try {
    const updated = await MenuItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/menu/:id', async (req, res) => {
  try {
    await MenuItem.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Settings
app.get('/api/settings', async (req, res) => {
  try {
    res.json(await Settings.findOne() || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    res.json(await Settings.findOneAndUpdate({}, req.body, { upsert: true, new: true }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bookings
app.get('/api/bookings/food', async (req, res) => {
  try {
    res.json(await FoodBooking.find().sort({ date: -1 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bookings/food', async (req, res) => {
  try {
    res.json(await new FoodBooking(req.body).save());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/bookings/food/:id', async (req, res) => {
  try {
    await FoodBooking.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bookings/hall', async (req, res) => {
  try {
    res.json(await HallBooking.find().sort({ bookedAt: -1 }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bookings/hall', async (req, res) => {
  try {
    res.json(await new HallBooking(req.body).save());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/bookings/hall/:id', async (req, res) => {
  try {
    await HallBooking.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── STATIC FILES ────────────────────────────────────────
app.use(express.static(publicPath));

// ─── CATCH-ALL ───────────────────────────────────────────
app.get('*', (req, res) => {
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`Error: Cannot find frontend files. Looking at ${indexPath}. Please ensure your "public" folder is in the root of your repository.`);
  }
});

// START
const start = async () => {
  try {
    await connectToDatabase();
    await seedData();
    app.listen(PORT, () => console.log(`🚀 Server on port ${PORT} with DB connected`));
  } catch (err) {
    console.error('Startup Error:', err);
    // Start server anyway so logs are visible
    app.listen(PORT, () => console.log(`🚀 Server on ${PORT} (DB Connection Failed)`));
  }
};
start();
