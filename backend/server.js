// backend/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// ---------- MongoDB Connection ----------
const MONGODB_URI = process.env.MONGODB_URI;
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// ---------- Mongoose Models ----------
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const User = mongoose.model('User', UserSchema);

const UploadSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  link: String,
  filename: String,
  originalName: String,
  fileSize: Number,
  filePath: String,
  uploadDate: { type: Date, default: Date.now },
  status: { type: String, default: 'uploaded' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  username: String
});
const Upload = mongoose.model('Upload', UploadSchema);

// ---------- JWT Secret ----------
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// ---------- Multer ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}-${file.originalname}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

// ---------- Authentication ----------
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ success: false, error: 'No token' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

const isAdmin = async (req, res, next) => {
  const user = await User.findById(req.userId);
  if (!user || !user.isAdmin) {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
};

// ---------- WebSocket ----------
const clients = new Set();
wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
});

const broadcastUpdate = (data) => {
  const msg = JSON.stringify({ type: 'update', data });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
};

// ---------- Routes ----------

// Register
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, error: 'Missing fields' });
  const existing = await User.findOne({ username });
  if (existing) return res.status(400).json({ success: false, error: 'Username exists' });
  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hashed });
  await user.save();
  res.json({ success: true, message: 'User created' });
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ success: false, error: 'Invalid credentials' });
  const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1d' });
  res.json({ success: true, token, userId: user._id, username: user.username, isAdmin: user.isAdmin });
});

// Get user's own uploads
app.get('/api/data', authenticate, async (req, res) => {
  const uploads = await Upload.find({ userId: req.userId }).sort({ uploadDate: -1 });
  res.json({ success: true, data: uploads });
});

// Upload
app.post('/api/upload', authenticate, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, error: 'File is required' });
  const { title, description, link } = req.body;
  if (!title) return res.status(400).json({ success: false, error: 'Title is required' });

  const user = await User.findById(req.userId);
  const uploadDoc = new Upload({
    title,
    description: description || '',
    link: link || '',
    filename: req.file.filename,
    originalName: req.file.originalname,
    fileSize: req.file.size,
    filePath: `/uploads/${req.file.filename}`,
    userId: req.userId,
    username: user.username
  });
  await uploadDoc.save();
  broadcastUpdate(uploadDoc);
  res.json({ success: true, data: uploadDoc });
});

// Delete own upload
app.delete('/api/data/:id', authenticate, async (req, res) => {
  const upload = await Upload.findOne({ _id: req.params.id, userId: req.userId });
  if (!upload) return res.status(404).json({ success: false, error: 'Not found or not yours' });
  if (upload.filePath) {
    const filePath = path.join(__dirname, upload.filePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  await upload.deleteOne();
  res.json({ success: true });
});

// Public share
app.get('/api/shared/:id', async (req, res) => {
  const upload = await Upload.findById(req.params.id);
  if (!upload) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: upload });
});

// ---------- Admin routes ----------
app.get('/api/admin/users', authenticate, isAdmin, async (req, res) => {
  const users = await User.find({}).select('-password');
  res.json({ success: true, users });
});

app.get('/api/admin/uploads', authenticate, isAdmin, async (req, res) => {
  const uploads = await Upload.find({}).sort({ uploadDate: -1 });
  res.json({ success: true, data: uploads });
});

app.delete('/api/admin/uploads/:id', authenticate, isAdmin, async (req, res) => {
  const upload = await Upload.findByIdAndDelete(req.params.id);
  if (!upload) return res.status(404).json({ success: false, error: 'Not found' });
  if (upload.filePath) {
    const filePath = path.join(__dirname, upload.filePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  res.json({ success: true });
});

// ---------- Start ----------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));