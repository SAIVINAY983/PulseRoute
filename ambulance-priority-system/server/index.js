import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pulseroute';
const JWT_SECRET = process.env.JWT_SECRET || 'development_only_change_me';
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

const ambulanceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, name: String,
  severity: { type: String, enum: ['Critical', 'High', 'Moderate'], default: 'Moderate' },
  patient: String, eta: String, distance: String, speed: String, route: String,
  status: { type: String, default: 'Awaiting priority' }, color: String,
  x: { type: Number, default: 50 }, y: { type: Number, default: 50 }
}, { timestamps: true });
const signalSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, name: String,
  state: String, light: { type: String, enum: ['red', 'yellow', 'green'], default: 'red' },
  mode: String, x: Number, y: Number
}, { timestamps: true });
const eventSchema = new mongoose.Schema({ message: { type: String, required: true }, type: { type: String, default: 'system' }, createdAt: { type: Date, default: Date.now } });
const userSchema = new mongoose.Schema({ email: { type: String, required: true, unique: true, lowercase: true }, passwordHash: { type: String, required: true }, role: { type: String, enum: ['operator', 'admin'], default: 'operator' } }, { timestamps: true });
const supportTicketSchema = new mongoose.Schema({
  ticketNumber: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  email: { type: String, required: true, lowercase: true },
  category: { type: String, required: true, maxlength: 80 },
  severity: { type: String, enum: ['Low', 'Normal', 'High', 'Critical'], default: 'Normal' },
  subject: { type: String, required: true, minlength: 4, maxlength: 120 },
  description: { type: String, required: true, minlength: 10, maxlength: 3000 },
  status: { type: String, enum: ['Open', 'In review', 'Resolved'], default: 'Open' }
}, { timestamps: true });
const settingsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  theme: { type: String, enum: ['dark', 'light', 'system'], default: 'dark' },
  refreshInterval: { type: Number, enum: [10, 30, 60], default: 30 },
  emergencyNotifications: { type: Boolean, default: true },
  alertSounds: { type: Boolean, default: false }
}, { timestamps: true });
const Ambulance = mongoose.model('Ambulance', ambulanceSchema);
const Signal = mongoose.model('Signal', signalSchema);
const Event = mongoose.model('Event', eventSchema);
const User = mongoose.model('User', userSchema);
const UserSettings = mongoose.model('UserSettings', settingsSchema);
const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ message: 'Invalid or expired token' }); }
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'PulseRoute API', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
app.post('/api/auth/register', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || password.length < 8) return res.status(400).json({ message: 'Provide a valid email and password with at least 8 characters' });
    if (await User.findOne({ email })) return res.status(409).json({ message: 'An account with this email already exists' });
    const user = await User.create({ email, passwordHash: await bcrypt.hash(password, 12), role: 'operator' });
    return res.status(201).json({ message: 'Account created', user: { email: user.email, role: user.role } });
  } catch (error) { return res.status(500).json({ message: 'Could not register user' }); }
});
app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = await User.findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Invalid email or password' });
  const token = jwt.sign({ sub: user._id.toString(), email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: { email: user.email, role: user.role } });
});

app.get('/api/settings', requireAuth, async (req, res) => {
  const saved = await UserSettings.findOne({ userId: req.user.sub }).lean();
  res.json({ theme: saved?.theme || 'dark', refreshInterval: saved?.refreshInterval || 30,
    emergencyNotifications: saved?.emergencyNotifications ?? true, alertSounds: saved?.alertSounds ?? false });
});
app.put('/api/settings', requireAuth, async (req, res) => {
  const body = req.body || {};
  const theme = ['dark', 'light', 'system'].includes(body.theme) ? body.theme : 'dark';
  const refreshInterval = [10, 30, 60].includes(Number(body.refreshInterval)) ? Number(body.refreshInterval) : 30;
  const emergencyNotifications = typeof body.emergencyNotifications === 'boolean' ? body.emergencyNotifications : true;
  const alertSounds = false; // Audio alerts are not implemented; keep this preference safely off.
  const saved = await UserSettings.findOneAndUpdate(
    { userId: req.user.sub },
    { $set: { theme, refreshInterval, emergencyNotifications, alertSounds }, $setOnInsert: { userId: req.user.sub } },
    { new: true, upsert: true, runValidators: true }
  ).lean();
  res.json({ theme: saved.theme, refreshInterval: saved.refreshInterval,
    emergencyNotifications: saved.emergencyNotifications, alertSounds: saved.alertSounds });
});

app.post('/api/support/tickets', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const category = String(body.category || '').trim().slice(0, 80);
    const severity = ['Low', 'Normal', 'High', 'Critical'].includes(body.severity) ? body.severity : 'Normal';
    const subject = String(body.subject || '').trim();
    const description = String(body.description || '').trim();
    if (category.length < 3) return res.status(400).json({ message: 'Choose a valid problem category' });
    if (subject.length < 4 || subject.length > 120) return res.status(400).json({ message: 'Summary must be 4–120 characters' });
    if (description.length < 10 || description.length > 3000) return res.status(400).json({ message: 'Description must be 10–3000 characters' });
    const ticketNumber = `PR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const ticket = await SupportTicket.create({ ticketNumber, userId: req.user.sub, email: req.user.email, category, severity, subject, description });
    await Event.create({ message: `Support ticket ${ticketNumber} submitted (${severity})`, type: 'system' });
    res.status(201).json({ message: 'Support report saved', ticket: { ticketNumber: ticket.ticketNumber, category: ticket.category, severity: ticket.severity, subject: ticket.subject, status: ticket.status, createdAt: ticket.createdAt } });
  } catch (error) {
    console.error('Support ticket creation failed:', error.message);
    res.status(500).json({ message: 'Could not save support report' });
  }
});
app.get('/api/support/tickets', requireAuth, async (req, res) => {
  const tickets = await SupportTicket.find({ userId: req.user.sub }).sort({ createdAt: -1 }).limit(50).select('ticketNumber category severity subject status createdAt').lean();
  res.json(tickets);
});

app.get('/api/ambulances', requireAuth, async (_req, res) => res.json(await Ambulance.find().sort({ createdAt: 1 }).lean()));
app.post('/api/ambulances', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const id = body.id || `AMB-${Math.floor(100 + Math.random() * 900)}`;
    const created = await Ambulance.create({ ...body, id });
    await Event.create({ message: `${id} registered for dispatch`, type: 'new' });
    res.status(201).json(created);
  } catch (error) { res.status(400).json({ message: 'Could not create ambulance', detail: error.message }); }
});
app.patch('/api/ambulances/:id', requireAuth, async (req, res) => {
  const item = await Ambulance.findOneAndUpdate({ id: req.params.id }, { $set: req.body }, { new: true, runValidators: true });
  if (!item) return res.status(404).json({ message: 'Ambulance not found' });
  res.json(item);
});
app.get('/api/signals', requireAuth, async (_req, res) => res.json(await Signal.find().sort({ id: 1 }).lean()));
app.patch('/api/signals/:id', requireAuth, async (req, res) => {
  const item = await Signal.findOneAndUpdate({ id: req.params.id }, { $set: req.body }, { new: true, runValidators: true });
  if (!item) return res.status(404).json({ message: 'Signal not found' });
  res.json(item);
});
app.get('/api/events', requireAuth, async (_req, res) => res.json(await Event.find().sort({ createdAt: -1 }).limit(50).lean()));
app.post('/api/events', requireAuth, async (req, res) => {
  if (!req.body?.message) return res.status(400).json({ message: 'Event message is required' });
  res.status(201).json(await Event.create({ message: String(req.body.message), type: String(req.body.type || 'system') }));
});

async function seedDemoData() {
  if ((await Ambulance.countDocuments()) === 0) {
    await Ambulance.insertMany([
      { id: 'AMB-104', name: 'Unit 104', severity: 'Critical', patient: 'Cardiac emergency', eta: '04 min', distance: '2.1 km', speed: '42 km/h', route: 'North Avenue → City Hospital', status: 'En route', color: '#ff5b6e', x: 20, y: 58 },
      { id: 'AMB-208', name: 'Unit 208', severity: 'High', patient: 'Road accident', eta: '07 min', distance: '3.8 km', speed: '36 km/h', route: 'Market Road → Trauma Centre', status: 'Awaiting priority', color: '#f6b94a', x: 48, y: 29 },
      { id: 'AMB-315', name: 'Unit 315', severity: 'Moderate', patient: 'Respiratory distress', eta: '11 min', distance: '6.4 km', speed: '31 km/h', route: 'University Road → General Hospital', status: 'Approaching', color: '#48d6b0', x: 73, y: 71 }
    ]);
  }
  if ((await Signal.countDocuments()) === 0) {
    await Signal.insertMany([
      { id: 'SIG-01', name: 'North Avenue / 5th St', state: 'Normal cycle', light: 'green', mode: 'Adaptive control', x: 34, y: 45 },
      { id: 'SIG-02', name: 'Market Road / Central', state: 'Normal cycle', light: 'red', mode: 'Adaptive control', x: 61, y: 40 },
      { id: 'SIG-03', name: 'University Rd / Ring Rd', state: 'Normal cycle', light: 'green', mode: 'Adaptive control', x: 75, y: 59 },
      { id: 'SIG-04', name: 'Hospital Link / East Gate', state: 'Normal cycle', light: 'red', mode: 'Adaptive control', x: 47, y: 75 }
    ]);
  }
  const demoEmail = 'operator@pulseroute.demo';
  if (!(await User.findOne({ email: demoEmail }))) {
    await User.create({ email: demoEmail, passwordHash: await bcrypt.hash('demo1234', 12), role: 'admin' });
  }
  if ((await Event.countDocuments()) === 0) await Event.create({ message: 'PulseRoute API initialized with simulated demo data', type: 'system' });
}

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log(`MongoDB connected: ${MONGODB_URI}`);
    await seedDemoData();
    app.listen(PORT, () => console.log(`PulseRoute API listening at http://localhost:${PORT}`));
  })
  .catch(error => { console.error('MongoDB connection failed:', error.message); process.exit(1); });
