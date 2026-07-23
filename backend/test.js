// backend/test.js
require('dotenv').config();
const mongoose = require('mongoose');

console.log('MONGODB_URI:', process.env.MONGODB_URI);
mongoose.connect(process.env.MONGODB_URI)
  .then(() => { console.log('✅ Connection successful!'); process.exit(); })
  .catch(err => { console.error('❌ Connection error:', err); process.exit(); });