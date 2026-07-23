// backend/create_admin.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define schema inline
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

async function createAdmin() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI not defined in .env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  const existing = await User.findOne({ username: 'admin' });
  if (existing) {
    console.log('✅ Admin already exists.');
    process.exit();
  }
  const hashed = await bcrypt.hash('admin123', 10);
  const admin = new User({ username: 'admin', password: hashed, isAdmin: true });
  await admin.save();
  console.log('✅ Admin user created: username=admin, password=admin123');
  process.exit();
}

createAdmin();