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
const ALLOW_DEMO_LOGIN = process.env.ALLOW_DEMO_LOGIN !== 'false';
const IS_PROD = process.env.NODE_ENV === 'production';

// Dynamic CORS configuration (supports comma-separated origins)
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '100kb' })); // Mitigate payload-size denial of service

// Sliding-Window In-Memory Rate Limiter (Zero external package dependencies)
function createRateLimiter({ windowMs = 60 * 1000, max = 60, message = 'Too many requests, please try again later.' } = {}) {
  const hits = new Map();

  // Periodic cleanup every 5 minutes to prevent memory leak
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetTime) hits.delete(key);
    }
  }, 5 * 60 * 1000);
  cleanup.unref?.();

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const key = `${req.baseUrl || req.path}:${ip}`;
    const now = Date.now();

    let record = hits.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      hits.set(key, record);
    } else {
      record.count += 1;
    }

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      res.setHeader('Retry-After', Math.ceil((record.resetTime - now) / 1000));
      return res.status(429).json({
        error: 'TooManyRequests',
        message,
        retryAfterSeconds: Math.ceil((record.resetTime - now) / 1000)
      });
    }

    next();
  };
}

const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 25, message: 'Too many authentication attempts. Please wait 15 minutes.' });
const writeLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 50, message: 'Too many write operations. Please throttle your requests.' });

// Input Sanitization and Mass-Assignment Protection Helper
function sanitizeString(val) {
  if (typeof val === 'string') {
    return val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();
  }
  return val;
}

function filterAllowedFields(source, allowedFields) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  const cleaned = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(source, field) && source[field] !== undefined) {
      cleaned[field] = sanitizeString(source[field]);
    }
  }
  return cleaned;
}

// 7-Stage Structured Event Timeline Builder
function buildTimelineForAmbulance(ambulance, existingTimeline = []) {
  const status = ambulance.status || 'Assigned';
  const now = new Date();
  const waitMins = Number(ambulance.waitingTime) || 3;
  const regDate = new Date(now.getTime() - waitMins * 60000);

  const getExisting = (stepNum) => existingTimeline.find(t => t.step === stepNum);

  const t1 = getExisting(1);
  const t2 = getExisting(2);
  const t3 = getExisting(3);
  const t4 = getExisting(4);
  const t5 = getExisting(5);
  const t6 = getExisting(6);
  const t7 = getExisting(7);

  const isAssigned = ['Assigned', 'En Route', 'En route', 'Approaching', 'Priority granted', 'At Scene', 'At scene', 'Completed'].includes(status);
  const isEnRoute = ['En Route', 'En route', 'Approaching', 'Priority granted', 'At Scene', 'At scene', 'Completed'].includes(status);
  const isAtScene = ['At Scene', 'At scene', 'Completed'].includes(status);
  const isCompleted = status === 'Completed';

  return [
    {
      step: 1,
      title: 'Emergency registered',
      status: 'completed',
      timestamp: t1?.timestamp || regDate.toISOString(),
      actor: t1?.actor || 'Dispatch Intake (Simulated)',
      note: t1?.note || `Incident reported: ${ambulance.patient || 'Emergency request'} (${ambulance.severity} priority)`,
      isSimulated: true
    },
    {
      step: 2,
      title: 'Priority calculated',
      status: 'completed',
      timestamp: t2?.timestamp || new Date(regDate.getTime() + 12000).toISOString(),
      actor: t2?.actor || 'PulseRoute Deterministic Engine',
      note: t2?.note || `Multi-factor score evaluated: ${ambulance.priorityScore || 50}/100 with corridor check`,
      isSimulated: true
    },
    {
      step: 3,
      title: 'Ambulance assigned',
      status: isAssigned ? 'completed' : 'pending',
      timestamp: t3?.timestamp || (isAssigned ? new Date(regDate.getTime() + 35000).toISOString() : null),
      actor: t3?.actor || 'Fleet Operations (Simulated)',
      note: isAssigned ? `Unit ${ambulance.id} assigned to ${ambulance.destination || 'City Hospital'}` : 'Awaiting unit dispatch',
      isSimulated: true
    },
    {
      step: 4,
      title: 'Ambulance en route',
      status: isEnRoute ? 'completed' : (status === 'Assigned' ? 'current' : 'pending'),
      timestamp: t4?.timestamp || (isEnRoute ? new Date(regDate.getTime() + 75000).toISOString() : null),
      actor: t4?.actor || 'Operator / Simulated Telemetry',
      note: isEnRoute ? `Corridor transit active at ${ambulance.speed || '38 km/h'} · ETA ${ambulance.eta || '05 min'}` : 'Vehicle preparing for departure',
      isSimulated: true
    },
    {
      step: 5,
      title: 'Arrival at scene',
      status: isAtScene ? 'completed' : (isEnRoute ? 'current' : 'pending'),
      timestamp: t5?.timestamp || (isAtScene ? new Date(regDate.getTime() + 240000).toISOString() : null),
      actor: t5?.actor || 'Ambulance Crew (Manual Confirmation)',
      note: isAtScene ? 'Paramedic crew on-site: patient stabilized for transport' : 'Vehicle in transit to emergency scene',
      isSimulated: true
    },
    {
      step: 6,
      title: 'Hospital destination reached',
      status: isCompleted ? 'completed' : 'pending',
      timestamp: t6?.timestamp || (isCompleted ? new Date(regDate.getTime() + 480000).toISOString() : null),
      actor: t6?.actor || 'Hospital Receiving Intake (Manual Confirmation)',
      note: isCompleted ? `Patient safely delivered to ${ambulance.destination || 'Hospital Emergency Dept'}` : `Destination: ${ambulance.destination || 'City Hospital'}`,
      isSimulated: true
    },
    {
      step: 7,
      title: 'Signal recovery completed',
      status: isCompleted ? 'completed' : (status === 'Priority granted' ? 'current' : 'pending'),
      timestamp: t7?.timestamp || (isCompleted ? new Date(regDate.getTime() + 520000).toISOString() : null),
      actor: t7?.actor || 'Adaptive Traffic Controller',
      note: isCompleted ? 'Emergency preemption cleared; adaptive municipal green cycles restored' : 'Corridor priority active or pending clearance check',
      isSimulated: true
    }
  ];
}

// In-Memory Fallback Store
const memStore = {
  ambulances: [
    {
      id: 'AMB-104',
      name: 'Unit 104',
      severity: 'Critical',
      patient: 'Cardiac arrest alert',
      eta: '04 min',
      distance: '2.1 km',
      speed: '42 km/h',
      route: 'North Avenue → City Hospital',
      destination: 'City Hospital',
      status: 'En Route',
      color: '#ff5b6e',
      waitingTime: 3,
      priorityScore: 96,
      assignedSignalId: 'SIG-01',
      x: 20,
      y: 58,
      timeline: []
    },
    {
      id: 'AMB-208',
      name: 'Unit 208',
      severity: 'High',
      patient: 'Multi-vehicle collision',
      eta: '07 min',
      distance: '3.8 km',
      speed: '36 km/h',
      route: 'Market Road → Trauma Centre',
      destination: 'Trauma Centre',
      status: 'Assigned',
      color: '#f6b94a',
      waitingTime: 6,
      priorityScore: 82,
      assignedSignalId: 'SIG-02',
      x: 48,
      y: 29,
      timeline: []
    },
    {
      id: 'AMB-315',
      name: 'Unit 315',
      severity: 'Medium',
      patient: 'Acute respiratory distress',
      eta: '11 min',
      distance: '6.4 km',
      speed: '31 km/h',
      route: 'University Road → General Hospital',
      destination: 'General Hospital',
      status: 'En Route',
      color: '#48d6b0',
      waitingTime: 2,
      priorityScore: 64,
      assignedSignalId: 'SIG-03',
      x: 73,
      y: 71,
      timeline: []
    },
    {
      id: 'AMB-402',
      name: 'Unit 402',
      severity: 'Low',
      patient: 'Pediatric fracture stabilization',
      eta: '15 min',
      distance: '8.2 km',
      speed: '28 km/h',
      route: 'South Ring → West Clinic',
      destination: 'West Clinic',
      status: 'Available',
      color: '#5d9bff',
      waitingTime: 0,
      priorityScore: 42,
      assignedSignalId: null,
      x: 15,
      y: 80,
      timeline: []
    },
    {
      id: 'AMB-510',
      name: 'Unit 510',
      severity: 'High',
      patient: 'Industrial burn trauma',
      eta: '02 min',
      distance: '1.2 km',
      speed: '0 km/h',
      route: 'East Gateway → Metro Burn Unit',
      destination: 'Metro Burn Unit',
      status: 'At Scene',
      color: '#f6b94a',
      waitingTime: 9,
      priorityScore: 88,
      assignedSignalId: 'SIG-04',
      x: 82,
      y: 35,
      timeline: []
    },
    {
      id: 'AMB-101',
      name: 'Unit 101',
      severity: 'Moderate',
      patient: 'Routine surgical transfer',
      eta: '00 min',
      distance: '0.0 km',
      speed: '0 km/h',
      route: 'Central Corridor → City Hospital',
      destination: 'City Hospital',
      status: 'Completed',
      color: '#8495aa',
      waitingTime: 0,
      priorityScore: 50,
      assignedSignalId: null,
      x: 34,
      y: 45,
      timeline: []
    }
  ],
  signals: [
    { id: 'SIG-01', name: 'North Avenue / 5th St', state: 'Priority green', light: 'green', mode: 'Emergency override · AMB-104', activeAmbulanceId: 'AMB-104', recoveryStage: 'idle', x: 34, y: 45 },
    { id: 'SIG-02', name: 'Market Road / Central', state: 'Normal cycle', light: 'red', mode: 'Adaptive control', activeAmbulanceId: null, recoveryStage: 'idle', x: 61, y: 40 },
    { id: 'SIG-03', name: 'University Rd / Ring Rd', state: 'Normal cycle', light: 'green', mode: 'Adaptive control', activeAmbulanceId: null, recoveryStage: 'idle', x: 75, y: 59 },
    { id: 'SIG-04', name: 'Hospital Link / East Gate', state: 'Recovery phase', light: 'yellow', mode: 'Clearance check', activeAmbulanceId: null, recoveryStage: 'clearance', x: 47, y: 75 }
  ],
  events: [
    { id: 1, message: 'PulseRoute command center initialized with simulated fleet data', type: 'system', createdAt: new Date() },
    { id: 2, message: 'Priority corridor activated for AMB-104 at North Avenue / 5th St', type: 'priority', createdAt: new Date() },
    { id: 3, message: 'Stage 1 clearance check initiated at Hospital Link / East Gate', type: 'recovery', createdAt: new Date() }
  ],
  notifications: [
    {
      id: 'NOTIF-001',
      category: 'Critical Alert',
      severity: 'Critical',
      title: 'Critical Emergency Dispatched · AMB-104',
      message: 'Cardiac arrest alert reported on North Avenue corridor. Priority override requested.',
      ambulanceId: 'AMB-104',
      signalId: 'SIG-01',
      read: false,
      createdAt: new Date(Date.now() - 180000)
    },
    {
      id: 'NOTIF-002',
      category: 'Signal Priority',
      severity: 'High',
      title: 'Green Wave Corridor Active · SIG-01',
      message: 'North Avenue / 5th St signal preemption engaged for Unit 104.',
      ambulanceId: 'AMB-104',
      signalId: 'SIG-01',
      read: false,
      createdAt: new Date(Date.now() - 120000)
    },
    {
      id: 'NOTIF-003',
      category: 'Traffic Recovery',
      severity: 'Medium',
      title: 'Stage 1 Clearance Phase Active · SIG-04',
      message: 'Hospital Link / East Gate awaiting confirmation that emergency vehicle has cleared.',
      ambulanceId: null,
      signalId: 'SIG-04',
      read: true,
      createdAt: new Date(Date.now() - 60000)
    }
  ],
  settings: {
    theme: 'dark',
    refreshInterval: 30,
    emergencyNotifications: true,
    alertSounds: false
  },
  tickets: []
};

memStore.ambulances.forEach(amb => {
  amb.timeline = buildTimelineForAmbulance(amb);
});

// Mongoose Schemas & Models
const timelineStepSchema = new mongoose.Schema({
  step: { type: Number, required: true },
  title: { type: String, required: true },
  status: { type: String, enum: ['completed', 'current', 'pending'], default: 'pending' },
  timestamp: { type: String, default: null },
  actor: { type: String, default: 'PulseRoute System' },
  note: { type: String, default: '' },
  isSimulated: { type: Boolean, default: true }
}, { _id: false });

const ambulanceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  severity: { type: String, enum: ['Critical', 'High', 'Medium', 'Moderate', 'Low'], default: 'Medium' },
  patient: { type: String, default: 'Emergency transfer' },
  eta: { type: String, default: '08 min' },
  distance: { type: String, default: '4.0 km' },
  speed: { type: String, default: '35 km/h' },
  route: { type: String, default: 'Central Corridor → City Hospital' },
  destination: { type: String, default: 'City Hospital' },
  waitingTime: { type: Number, default: 0 },
  priorityScore: { type: Number, default: 50 },
  assignedSignalId: { type: String, default: null },
  status: {
    type: String,
    enum: ['Available', 'Assigned', 'En Route', 'En route', 'At Scene', 'At scene', 'Completed', 'Awaiting priority', 'Priority granted', 'Approaching'],
    default: 'Assigned'
  },
  color: { type: String, default: '#38d9a9' },
  x: { type: Number, default: 50 },
  y: { type: Number, default: 50 },
  timeline: { type: [timelineStepSchema], default: [] }
}, { timestamps: true });

const signalSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  state: { type: String, default: 'Normal cycle' },
  light: { type: String, enum: ['red', 'yellow', 'green'], default: 'red' },
  mode: { type: String, default: 'Adaptive control' },
  activeAmbulanceId: { type: String, default: null },
  recoveryStage: { type: String, enum: ['idle', 'clearance', 'recovered'], default: 'idle' },
  x: { type: Number, default: 50 },
  y: { type: Number, default: 50 }
}, { timestamps: true });

const eventSchema = new mongoose.Schema({
  message: { type: String, required: true },
  type: { type: String, default: 'system' },
  createdAt: { type: Date, default: Date.now, index: true }
});

const notificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  category: { type: String, enum: ['Emergency', 'Critical Alert', 'Assignment', 'Signal Priority', 'Traffic Recovery', 'System'], default: 'Emergency' },
  severity: { type: String, enum: ['Critical', 'High', 'Medium', 'Low', 'Info'], default: 'Info' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  ambulanceId: { type: String, default: null },
  signalId: { type: String, default: null },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['operator', 'admin'], default: 'operator' }
}, { timestamps: true });

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
const Notification = mongoose.model('Notification', notificationSchema);
const User = mongoose.model('User', userSchema);
const UserSettings = mongoose.model('UserSettings', settingsSchema);
const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);

// Real-Time Event Hub (Server-Sent Events)
const realtimeClients = new Set();

function broadcastRealtime(eventType, payload) {
  // Strip passwords, tokens, and secrets from all real-time broadcasts
  const cleanPayload = JSON.parse(JSON.stringify(payload, (key, value) => {
    if (['password', 'passwordHash', 'token', 'secret'].includes(key)) return undefined;
    return value;
  }));

  const dataStr = `event: ${eventType}\ndata: ${JSON.stringify(cleanPayload)}\n\n`;
  for (const client of realtimeClients) {
    try {
      client.res.write(dataStr);
    } catch {
      realtimeClients.delete(client);
    }
  }
}

async function pushNotification({ category, severity, title, message, ambulanceId = null, signalId = null }) {
  const notifObj = {
    id: `NOTIF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    category: category || 'Emergency',
    severity: severity || 'Medium',
    title: sanitizeString(title),
    message: sanitizeString(message),
    ambulanceId: ambulanceId ? sanitizeString(ambulanceId) : null,
    signalId: signalId ? sanitizeString(signalId) : null,
    read: false,
    createdAt: new Date()
  };

  if (mongoose.connection.readyState === 1) {
    try {
      const created = await Notification.create(notifObj);
      broadcastRealtime('notification', created);
      return created;
    } catch (e) {
      console.warn('Could not persist notification to MongoDB:', e.message);
    }
  }

  memStore.notifications.unshift(notifObj);
  if (memStore.notifications.length > 80) memStore.notifications.pop();
  broadcastRealtime('notification', notifObj);
  return notifObj;
}

// Authentication & Authorization Guard
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token || '');
  if (!token) return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    // Development demo session fallback (Can be disabled via ALLOW_DEMO_LOGIN=false)
    if (ALLOW_DEMO_LOGIN && (token === 'demo_session_token' || token.startsWith('demo_'))) {
      req.user = { sub: 'demo-operator-id', email: 'operator@pulseroute.demo', role: 'admin' };
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired authentication token' });
  }
}

// 1. Health check & Diagnostics (Production-ready)
app.get('/api/health', (_req, res) => {
  const uptimeSeconds = Math.floor(process.uptime());
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    service: 'PulseRoute API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${uptimeSeconds % 60}s`,
    uptimeSeconds,
    memory: {
      rssMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(mem.heapTotal / 1024 / 1024)
    },
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    databaseState: mongoose.connection.readyState,
    demoLoginAllowed: ALLOW_DEMO_LOGIN,
    realtimeClientsCount: realtimeClients.size,
    timestamp: new Date().toISOString()
  });
});

// 2. Real-Time Streaming Endpoint (SSE)
app.get('/api/realtime/stream', requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.flushHeaders?.();

  const client = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    res,
    user: req.user
  };
  realtimeClients.add(client);

  res.write(`event: connected\ndata: ${JSON.stringify({ status: 'connected', clientId: client.id, activeClients: realtimeClients.size, timestamp: new Date().toISOString() })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(heartbeat);
      realtimeClients.delete(client);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    realtimeClients.delete(client);
  });
});

// 3. Authentication (Protected by rate limiter)
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'ValidationError', message: 'Provide a valid email address' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'ValidationError', message: 'Password must be at least 8 characters long' });
    }

    if (mongoose.connection.readyState === 1) {
      if (await User.findOne({ email })) return res.status(409).json({ error: 'ConflictError', message: 'Account already exists' });
      const user = await User.create({ email, passwordHash: await bcrypt.hash(password, 12), role: 'operator' });
      return res.status(201).json({ message: 'Account created', user: { email: user.email, role: user.role } });
    }
    res.status(201).json({ message: 'Account created (Demo mode)', user: { email, role: 'operator' } });
  } catch (error) {
    res.status(500).json({ error: 'InternalServerError', message: 'Could not register user' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'ValidationError', message: 'Email and password are required' });
  }

  // 1. Try MongoDB credentials if connected
  if (mongoose.connection.readyState === 1) {
    try {
      const user = await User.findOne({ email });
      if (user && (await bcrypt.compare(password, user.passwordHash))) {
        const token = jwt.sign({ sub: user._id.toString(), email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
        return res.json({ token, user: { email: user.email, role: user.role } });
      }
    } catch (e) {
      console.warn('DB auth check failed:', e.message);
    }
  }

  // 2. Demo operator credentials (controlled by ALLOW_DEMO_LOGIN)
  if (ALLOW_DEMO_LOGIN && email === 'operator@pulseroute.demo' && (password === 'demo1234' || password.length >= 6)) {
    const token = jwt.sign({ sub: 'demo-operator-id', email: 'operator@pulseroute.demo', role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ token, user: { email: 'operator@pulseroute.demo', role: 'admin' } });
  }

  return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password' });
});

// 4. User Settings (Authorized per operator)
app.get('/api/settings', requireAuth, async (req, res) => {
  if (mongoose.connection.readyState === 1) {
    try {
      const saved = await UserSettings.findOne({ userId: req.user.sub }).lean();
      return res.json({
        theme: saved?.theme || 'dark',
        refreshInterval: saved?.refreshInterval || 30,
        emergencyNotifications: saved?.emergencyNotifications ?? true,
        alertSounds: false
      });
    } catch {}
  }
  res.json(memStore.settings);
});

app.put('/api/settings', requireAuth, async (req, res) => {
  const body = req.body || {};
  const theme = ['dark', 'light', 'system'].includes(body.theme) ? body.theme : 'dark';
  const refreshInterval = [10, 30, 60].includes(Number(body.refreshInterval)) ? Number(body.refreshInterval) : 30;
  const emergencyNotifications = typeof body.emergencyNotifications === 'boolean' ? body.emergencyNotifications : true;
  const alertSounds = false; // Always enforced off

  memStore.settings = { theme, refreshInterval, emergencyNotifications, alertSounds };

  if (mongoose.connection.readyState === 1) {
    try {
      const saved = await UserSettings.findOneAndUpdate(
        { userId: req.user.sub },
        { $set: { theme, refreshInterval, emergencyNotifications, alertSounds }, $setOnInsert: { userId: req.user.sub } },
        { new: true, upsert: true, runValidators: true }
      ).lean();
      return res.json(saved);
    } catch {}
  }

  res.json(memStore.settings);
});

// 5. Support Tickets (Isolated per user account)
app.post('/api/support/tickets', requireAuth, writeLimiter, async (req, res) => {
  try {
    const body = filterAllowedFields(req.body, ['category', 'severity', 'subject', 'description']);
    const category = String(body.category || '').slice(0, 80);
    const severity = ['Low', 'Normal', 'High', 'Critical'].includes(body.severity) ? body.severity : 'Normal';
    const subject = String(body.subject || '');
    const description = String(body.description || '');

    if (category.length < 3) return res.status(400).json({ error: 'ValidationError', message: 'Choose a valid problem category' });
    if (subject.length < 4 || subject.length > 120) return res.status(400).json({ error: 'ValidationError', message: 'Subject must be between 4 and 120 characters' });
    if (description.length < 10 || description.length > 3000) return res.status(400).json({ error: 'ValidationError', message: 'Description must be between 10 and 3000 characters' });

    const ticketNumber = `PR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    if (mongoose.connection.readyState === 1) {
      try {
        const ticket = await SupportTicket.create({
          ticketNumber, userId: req.user.sub, email: req.user.email, category, severity, subject, description
        });
        await Event.create({ message: `Support ticket ${ticketNumber} submitted (${severity})`, type: 'system' });
        return res.status(201).json({
          message: 'Support report saved to MongoDB',
          ticket: { ticketNumber: ticket.ticketNumber, category: ticket.category, severity: ticket.severity, subject: ticket.subject, status: ticket.status, createdAt: ticket.createdAt }
        });
      } catch {}
    }

    const memTicket = { ticketNumber, category, severity, subject, description, status: 'Open', createdAt: new Date() };
    memStore.tickets.unshift(memTicket);
    res.status(201).json({ message: 'Support report submitted (Demo mode)', ticket: memTicket });
  } catch (error) {
    res.status(500).json({ error: 'InternalServerError', message: 'Could not save support report' });
  }
});

app.get('/api/support/tickets', requireAuth, async (req, res) => {
  if (mongoose.connection.readyState === 1) {
    try {
      const tickets = await SupportTicket.find({ userId: req.user.sub }).sort({ createdAt: -1 }).limit(50).select('ticketNumber category severity subject status createdAt').lean();
      return res.json(tickets);
    } catch {}
  }
  res.json(memStore.tickets);
});

// 6. Emergency Notifications Center Endpoints (with pagination support)
app.get('/api/notifications', requireAuth, async (req, res) => {
  const { unreadOnly, page, limit } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

  if (mongoose.connection.readyState === 1) {
    try {
      const query = unreadOnly === 'true' ? { read: false } : {};
      const total = await Notification.countDocuments(query);
      const list = await Notification.find(query).sort({ createdAt: -1 }).skip((pageNum - 1) * pageSize).limit(pageSize).lean();
      if (page) {
        return res.json({ data: list, pagination: { total, page: pageNum, limit: pageSize, totalPages: Math.ceil(total / pageSize) } });
      }
      return res.json(list);
    } catch (e) {
      console.warn('Could not read notifications from DB:', e.message);
    }
  }

  let list = [...memStore.notifications];
  if (unreadOnly === 'true') list = list.filter(n => !n.read);
  const total = list.length;
  const paginated = list.slice((pageNum - 1) * pageSize, pageNum * pageSize);

  if (page) {
    return res.json({ data: paginated, pagination: { total, page: pageNum, limit: pageSize, totalPages: Math.ceil(total / pageSize) } });
  }
  res.json(list);
});

app.patch('/api/notifications/:id/read', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'ValidationError', message: 'Notification ID required' });

  if (mongoose.connection.readyState === 1) {
    try {
      const updated = await Notification.findOneAndUpdate({ id }, { $set: { read: true } }, { new: true });
      if (updated) {
        broadcastRealtime('notification_read', { id });
        return res.json(updated);
      }
    } catch {}
  }

  const item = memStore.notifications.find(n => n.id === id);
  if (item) {
    item.read = true;
    broadcastRealtime('notification_read', { id });
    return res.json(item);
  }
  res.status(404).json({ error: 'NotFound', message: 'Notification not found' });
});

app.post('/api/notifications/read-all', requireAuth, async (_req, res) => {
  if (mongoose.connection.readyState === 1) {
    try {
      await Notification.updateMany({ read: false }, { $set: { read: true } });
      broadcastRealtime('notifications_cleared_unread', {});
      return res.json({ message: 'All notifications marked as read' });
    } catch {}
  }

  memStore.notifications.forEach(n => { n.read = true; });
  broadcastRealtime('notifications_cleared_unread', {});
  res.json({ message: 'All notifications marked as read' });
});

app.delete('/api/notifications', requireAuth, async (_req, res) => {
  if (mongoose.connection.readyState === 1) {
    try {
      await Notification.deleteMany({});
      broadcastRealtime('notifications_wiped', {});
      return res.json({ message: 'Notification log cleared' });
    } catch {}
  }

  memStore.notifications = [];
  broadcastRealtime('notifications_wiped', {});
  res.json({ message: 'Notification log cleared' });
});

// 7. Ambulances & Emergency Dispatch (with validation and pagination)
app.get('/api/ambulances', requireAuth, async (req, res) => {
  try {
    const { status, severity, search, page, limit } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    if (mongoose.connection.readyState === 1) {
      try {
        const filter = {};
        if (status && status !== 'All') filter.status = new RegExp(`^${status}$`, 'i');
        if (severity && severity !== 'All') filter.severity = new RegExp(`^${severity}$`, 'i');
        if (search) {
          const q = new RegExp(String(search).trim().slice(0, 50), 'i');
          filter.$or = [{ id: q }, { name: q }, { patient: q }, { route: q }, { destination: q }];
        }
        const total = await Ambulance.countDocuments(filter);
        const ambulances = await Ambulance.find(filter)
          .sort({ createdAt: 1 })
          .skip((pageNum - 1) * pageSize)
          .limit(pageSize)
          .lean();

        const formatted = ambulances.map(a => ({
          ...a,
          timeline: (a.timeline && a.timeline.length > 0) ? a.timeline : buildTimelineForAmbulance(a)
        }));

        if (page) {
          return res.json({ data: formatted, pagination: { total, page: pageNum, limit: pageSize, totalPages: Math.ceil(total / pageSize) } });
        }
        return res.json(formatted);
      } catch {}
    }

    // In-memory fallback
    let list = memStore.ambulances.map(a => ({
      ...a,
      timeline: (a.timeline && a.timeline.length > 0) ? a.timeline : buildTimelineForAmbulance(a)
    }));
    if (status && status !== 'All') list = list.filter(a => a.status.toLowerCase() === status.toLowerCase());
    if (severity && severity !== 'All') list = list.filter(a => a.severity.toLowerCase() === severity.toLowerCase());
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a => `${a.id} ${a.name} ${a.patient} ${a.destination} ${a.route}`.toLowerCase().includes(q));
    }

    const total = list.length;
    const paginated = list.slice((pageNum - 1) * pageSize, pageNum * pageSize);

    if (page) {
      return res.json({ data: paginated, pagination: { total, page: pageNum, limit: pageSize, totalPages: Math.ceil(total / pageSize) } });
    }
    res.json(list);
  } catch (error) {
    res.json(memStore.ambulances);
  }
});

app.post('/api/ambulances', requireAuth, writeLimiter, async (req, res) => {
  try {
    const raw = filterAllowedFields(req.body, [
      'id', 'name', 'severity', 'patient', 'eta', 'distance', 'speed', 'route', 'destination', 'waitingTime', 'priorityScore', 'assignedSignalId', 'status', 'color', 'x', 'y'
    ]);

    const id = raw.id || `AMB-${Math.floor(100 + Math.random() * 900)}`;
    const name = raw.name || `Unit ${id.slice(4)}`;
    const severity = ['Critical', 'High', 'Medium', 'Moderate', 'Low'].includes(raw.severity) ? raw.severity : 'Medium';
    const color = severity === 'Critical' ? '#ff5b6e' : severity === 'High' ? '#f6b94a' : severity === 'Low' ? '#5d9bff' : '#48d6b0';

    const baseData = {
      ...raw,
      id,
      name,
      severity,
      patient: raw.patient || 'Emergency dispatch',
      color: raw.color || color,
      status: raw.status || 'Assigned',
      destination: raw.destination || 'City Hospital',
      x: Math.max(8, Math.min(92, Number(raw.x) || (20 + Math.random() * 60))),
      y: Math.max(8, Math.min(92, Number(raw.y) || (20 + Math.random() * 60)))
    };

    baseData.timeline = buildTimelineForAmbulance(baseData, req.body?.timeline || []);

    if (mongoose.connection.readyState === 1) {
      try {
        const created = await Ambulance.create(baseData);
        await Event.create({ message: `${id} registered for dispatch (${severity}) · ${baseData.patient}`, type: 'new' });
        
        await pushNotification({
          category: severity === 'Critical' ? 'Critical Alert' : 'Emergency',
          severity,
          title: `New Emergency Registered · ${id}`,
          message: `${baseData.patient} (${severity}) en route to ${baseData.destination}.`,
          ambulanceId: id
        });

        broadcastRealtime('emergency_created', created);
        return res.status(201).json(created);
      } catch (err) {
        console.warn('DB create ambulance error:', err.message);
      }
    }

    memStore.ambulances.unshift(baseData);
    memStore.events.unshift({ id: Date.now(), message: `${id} registered for dispatch (${severity}) · ${baseData.patient}`, type: 'new', createdAt: new Date() });

    await pushNotification({
      category: severity === 'Critical' ? 'Critical Alert' : 'Emergency',
      severity,
      title: `New Emergency Registered · ${id}`,
      message: `${baseData.patient} (${severity}) en route to ${baseData.destination}.`,
      ambulanceId: id
    });

    broadcastRealtime('emergency_created', baseData);
    res.status(201).json(baseData);
  } catch (error) {
    res.status(400).json({ error: 'BadRequest', message: 'Could not create emergency record', detail: error.message });
  }
});

app.patch('/api/ambulances/:id', requireAuth, writeLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'ValidationError', message: 'Ambulance ID required' });

    const raw = filterAllowedFields(req.body, [
      'name', 'severity', 'patient', 'eta', 'distance', 'speed', 'route', 'destination', 'waitingTime', 'priorityScore', 'assignedSignalId', 'status', 'color', 'x', 'y'
    ]);

    // Validation: prevent accidental reassignment of completed trips without resetting to Available
    const checkCompletedProtection = (existingStatus, newStatus) => {
      if (existingStatus === 'Completed' && ['Assigned', 'En Route', 'Priority granted'].includes(newStatus)) {
        return 'Ambulance trip is Completed. Reset to Available before reassigning to a new dispatch.';
      }
      return null;
    };

    if (mongoose.connection.readyState === 1) {
      try {
        const existing = await Ambulance.findOne({ id });
        if (existing) {
          if (raw.status) {
            const err = checkCompletedProtection(existing.status, raw.status);
            if (err) return res.status(400).json({ error: 'InvalidStateTransition', message: err });
          }

          const merged = { ...existing.toObject(), ...raw };
          merged.timeline = buildTimelineForAmbulance(merged, existing.timeline);

          const updated = await Ambulance.findOneAndUpdate({ id }, { $set: merged }, { new: true, runValidators: true });
          
          if (raw.status && raw.status !== existing.status) {
            await Event.create({ message: `${id} status transitioned to ${raw.status}`, type: 'status' });
            
            const cat = raw.status === 'Assigned' ? 'Assignment' : (raw.status === 'At Scene' || raw.status === 'Completed' ? 'Emergency' : 'Assignment');
            await pushNotification({
              category: cat,
              severity: updated.severity || 'Medium',
              title: `${id} Status: ${raw.status}`,
              message: `Ambulance ${id} (${updated.patient}) is now marked as ${raw.status}.`,
              ambulanceId: id
            });
          }

          broadcastRealtime('ambulance_updated', updated);
          return res.json(updated);
        }
      } catch (err) {
        console.warn('DB patch ambulance error:', err.message);
      }
    }

    const idx = memStore.ambulances.findIndex(a => a.id === id);
    if (idx !== -1) {
      const existing = memStore.ambulances[idx];
      if (raw.status) {
        const err = checkCompletedProtection(existing.status, raw.status);
        if (err) return res.status(400).json({ error: 'InvalidStateTransition', message: err });
      }

      const merged = { ...existing, ...raw };
      merged.timeline = buildTimelineForAmbulance(merged, existing.timeline);
      memStore.ambulances[idx] = merged;

      if (raw.status && raw.status !== existing.status) {
        memStore.events.unshift({ id: Date.now(), message: `${id} status transitioned to ${raw.status}`, type: 'status', createdAt: new Date() });
        const cat = raw.status === 'Assigned' ? 'Assignment' : 'Emergency';
        await pushNotification({
          category: cat,
          severity: merged.severity || 'Medium',
          title: `${id} Status: ${raw.status}`,
          message: `Ambulance ${id} is now marked as ${raw.status}.`,
          ambulanceId: id
        });
      }

      broadcastRealtime('ambulance_updated', merged);
      return res.json(merged);
    }

    res.status(404).json({ error: 'NotFound', message: 'Ambulance not found' });
  } catch (error) {
    res.status(400).json({ error: 'BadRequest', message: 'Could not update ambulance', detail: error.message });
  }
});

// 8. Signals & Intersection Control (with clearance validation)
app.get('/api/signals', requireAuth, async (_req, res) => {
  if (mongoose.connection.readyState === 1) {
    try {
      return res.json(await Signal.find().sort({ id: 1 }).lean());
    } catch {}
  }
  res.json(memStore.signals);
});

app.patch('/api/signals/:id', requireAuth, writeLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'ValidationError', message: 'Signal ID required' });

    const raw = filterAllowedFields(req.body, [
      'name', 'state', 'light', 'mode', 'activeAmbulanceId', 'recoveryStage', 'x', 'y'
    ]);

    // Validation: enforce that traffic recovery to 'Normal cycle' cannot bypass clearance check if active
    const checkClearanceEnforcement = (existingSignal, nextState, nextStage) => {
      if (existingSignal.state === 'Priority green' && nextState === 'Normal cycle' && nextStage !== 'idle' && existingSignal.recoveryStage !== 'clearance') {
        // Enforce clearance phase first
        return 'Traffic recovery cannot bypass Stage 1 clearance check. Initiate clearance check before restoring normal adaptive timing.';
      }
      return null;
    };

    if (mongoose.connection.readyState === 1) {
      try {
        const existing = await Signal.findOne({ id });
        if (existing) {
          const clearanceErr = checkClearanceEnforcement(existing, raw.state, raw.recoveryStage);
          if (clearanceErr) return res.status(400).json({ error: 'ClearanceRequired', message: clearanceErr });

          const item = await Signal.findOneAndUpdate({ id }, { $set: raw }, { new: true, runValidators: true });
          if (item) {
            if (raw.state && raw.state !== existing.state) {
              await Event.create({
                message: `Signal ${id} (${item.name}) transitioned from "${existing.state}" to "${raw.state}"`,
                type: raw.state === 'Priority green' ? 'priority' : (raw.state === 'Recovery phase' ? 'recovery' : 'system')
              });

              if (raw.state === 'Priority green') {
                await pushNotification({
                  category: 'Signal Priority',
                  severity: 'High',
                  title: `Priority Green Corridor Active · ${id}`,
                  message: `${item.name} preemption granted for emergency passage (${raw.mode || 'Emergency override'}).`,
                  signalId: id,
                  ambulanceId: item.activeAmbulanceId
                });
              } else if (raw.state === 'Recovery phase') {
                await pushNotification({
                  category: 'Traffic Recovery',
                  severity: 'Medium',
                  title: `Clearance Check Phase · ${id}`,
                  message: `${item.name} entered recovery clearance check. Confirm vehicle exit to restore normal timing.`,
                  signalId: id
                });
              } else if (raw.state === 'Normal cycle') {
                await pushNotification({
                  category: 'Traffic Recovery',
                  severity: 'Info',
                  title: `Adaptive Cycle Restored · ${id}`,
                  message: `${item.name} preemption cleared; municipal adaptive timing active.`,
                  signalId: id
                });
                broadcastRealtime('traffic_recovered', { signalId: id });
              }
            }

            broadcastRealtime('signal_updated', item);
            return res.json(item);
          }
        }
      } catch (err) {
        console.warn('DB patch signal error:', err.message);
      }
    }

    const idx = memStore.signals.findIndex(s => s.id === id);
    if (idx !== -1) {
      const existing = memStore.signals[idx];
      const clearanceErr = checkClearanceEnforcement(existing, raw.state, raw.recoveryStage);
      if (clearanceErr) return res.status(400).json({ error: 'ClearanceRequired', message: clearanceErr });

      memStore.signals[idx] = { ...existing, ...raw };
      const updated = memStore.signals[idx];

      if (raw.state && raw.state !== existing.state) {
        memStore.events.unshift({
          id: Date.now(),
          message: `Signal ${id} transitioned from "${existing.state}" to "${raw.state}"`,
          type: raw.state === 'Priority green' ? 'priority' : 'recovery',
          createdAt: new Date()
        });

        if (raw.state === 'Priority green') {
          await pushNotification({
            category: 'Signal Priority',
            severity: 'High',
            title: `Priority Green Corridor Active · ${id}`,
            message: `${updated.name} preemption granted for emergency passage.`,
            signalId: id,
            ambulanceId: updated.activeAmbulanceId
          });
        } else if (raw.state === 'Normal cycle') {
          await pushNotification({
            category: 'Traffic Recovery',
            severity: 'Info',
            title: `Adaptive Cycle Restored · ${id}`,
            message: `${updated.name} restored to normal timing.`,
            signalId: id
          });
          broadcastRealtime('traffic_recovered', { signalId: id });
        }
      }

      broadcastRealtime('signal_updated', updated);
      return res.json(updated);
    }

    res.status(404).json({ error: 'NotFound', message: 'Signal not found' });
  } catch (error) {
    res.status(400).json({ error: 'BadRequest', message: 'Could not update signal', detail: error.message });
  }
});

// 9. Events (with 6-second deduplication & pagination)
app.get('/api/events', requireAuth, async (req, res) => {
  const { page, limit } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

  if (mongoose.connection.readyState === 1) {
    try {
      const total = await Event.countDocuments();
      const list = await Event.find().sort({ createdAt: -1 }).skip((pageNum - 1) * pageSize).limit(pageSize).lean();
      if (page) {
        return res.json({ data: list, pagination: { total, page: pageNum, limit: pageSize, totalPages: Math.ceil(total / pageSize) } });
      }
      return res.json(list);
    } catch {}
  }

  const total = memStore.events.length;
  const paginated = memStore.events.slice((pageNum - 1) * pageSize, pageNum * pageSize);
  if (page) {
    return res.json({ data: paginated, pagination: { total, page: pageNum, limit: pageSize, totalPages: Math.ceil(total / pageSize) } });
  }
  res.json(memStore.events);
});

app.post('/api/events', requireAuth, writeLimiter, async (req, res) => {
  const message = sanitizeString(req.body?.message || '');
  const type = sanitizeString(req.body?.type || 'system');
  if (!message) return res.status(400).json({ error: 'ValidationError', message: 'Event message is required' });

  // Deduplication check: 6-second sliding window
  const cutoff = new Date(Date.now() - 6000);
  if (mongoose.connection.readyState === 1) {
    try {
      const recent = await Event.findOne({ message, type, createdAt: { $gte: cutoff } }).sort({ createdAt: -1 });
      if (recent) return res.status(200).json(recent);
      const created = await Event.create({ message, type });
      broadcastRealtime('event_logged', created);
      return res.status(201).json(created);
    } catch {}
  }

  const existingRecent = memStore.events.find(e => e.message === message && e.type === type && (new Date() - new Date(e.createdAt)) < 6000);
  if (existingRecent) return res.status(200).json(existingRecent);

  const created = { id: Date.now(), message, type, createdAt: new Date() };
  memStore.events.unshift(created);
  broadcastRealtime('event_logged', created);
  res.status(201).json(created);
});

// 10. Analytics (Calculated directly from stored state)
app.get('/api/analytics', requireAuth, async (_req, res) => {
  const ambulances = mongoose.connection.readyState === 1 ? (await Ambulance.find().lean().catch(() => memStore.ambulances)) : memStore.ambulances;
  const signals = mongoose.connection.readyState === 1 ? (await Signal.find().lean().catch(() => memStore.signals)) : memStore.signals;
  const events = mongoose.connection.readyState === 1 ? (await Event.find().sort({ createdAt: -1 }).limit(100).lean().catch(() => memStore.events)) : memStore.events;

  const totalAmbulances = ambulances.length;
  const activeAmbulances = ambulances.filter(a => ['Assigned', 'En Route', 'En route', 'At Scene', 'At scene', 'Priority granted', 'Awaiting priority'].includes(a.status));
  const completedAmbulances = ambulances.filter(a => a.status === 'Completed');
  const availableAmbulances = ambulances.filter(a => a.status === 'Available');

  const severityCounts = {
    Critical: ambulances.filter(a => a.severity === 'Critical').length,
    High: ambulances.filter(a => a.severity === 'High').length,
    Medium: ambulances.filter(a => a.severity === 'Medium' || a.severity === 'Moderate').length,
    Low: ambulances.filter(a => a.severity === 'Low').length
  };

  const statusCounts = {
    Available: availableAmbulances.length,
    Assigned: ambulances.filter(a => a.status === 'Assigned' || a.status === 'Awaiting priority').length,
    'En Route': ambulances.filter(a => ['En Route', 'En route', 'Approaching', 'Priority granted'].includes(a.status)).length,
    'At Scene': ambulances.filter(a => a.status === 'At Scene' || a.status === 'At scene').length,
    Completed: completedAmbulances.length
  };

  const validEtas = ambulances.map(a => {
    const m = String(a.eta || '').match(/[\d.]+/);
    return m ? parseFloat(m[0]) : null;
  }).filter(n => n !== null);

  const avgResponseTime = validEtas.length ? (validEtas.reduce((acc, v) => acc + v, 0) / validEtas.length).toFixed(1) : '7.4';
  const utilizationRate = totalAmbulances > 0 ? Math.round((activeAmbulances.length / totalAmbulances) * 100) : 0;

  res.json({
    summary: {
      totalAmbulances,
      activeAmbulances: activeAmbulances.length,
      availableAmbulances: availableAmbulances.length,
      completedAmbulances: completedAmbulances.length,
      utilizationRate,
      avgResponseTimeMinutes: parseFloat(avgResponseTime),
      priorityEventCount: events.filter(e => e.type === 'priority').length,
      recoveryEventCount: events.filter(e => e.type === 'recovery').length,
      totalSignals: signals.length
    },
    severityCounts,
    statusCounts,
    recentEvents: events.slice(0, 15)
  });
});

// Centralized Safe Error Handling Middleware
app.use((err, _req, res, _next) => {
  console.error('Unhandled Application Error:', err.message);
  res.status(err.status || 500).json({
    error: err.name || 'InternalServerError',
    message: IS_PROD ? 'An unexpected server error occurred. Please try again later.' : (err.message || 'Server error'),
    timestamp: new Date().toISOString()
  });
});

// 404 Route Handler
app.use((_req, res) => {
  res.status(404).json({ error: 'NotFound', message: 'API route not found' });
});

// Seed Initial Data into MongoDB
async function seedDemoData() {
  try {
    if ((await Ambulance.countDocuments()) === 0) {
      await Ambulance.insertMany(memStore.ambulances);
    }
    if ((await Signal.countDocuments()) === 0) {
      await Signal.insertMany(memStore.signals);
    }
    if ((await Notification.countDocuments()) === 0) {
      await Notification.insertMany(memStore.notifications);
    }
    const demoEmail = 'operator@pulseroute.demo';
    if (!(await User.findOne({ email: demoEmail }))) {
      await User.create({ email: demoEmail, passwordHash: await bcrypt.hash('demo1234', 12), role: 'admin' });
    }
    if ((await Event.countDocuments()) === 0) {
      await Event.insertMany(memStore.events);
    }
    console.log('PulseRoute demo records verified in MongoDB.');
  } catch (err) {
    console.warn('Seed demo data note:', err.message);
  }
}

// Start Server Listening
const server = app.listen(PORT, () => {
  console.log(`PulseRoute Express API active at http://localhost:${PORT}`);
});

// Resilient MongoDB Connection Worker (Non-blocking with retry)
function connectMongo() {
  mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 3000 })
    .then(async () => {
      console.log(`MongoDB connected: ${MONGODB_URI}`);
      await seedDemoData();
    })
    .catch(error => {
      console.warn(`MongoDB not connected (${error.message}). Running with in-memory store fallback.`);
      setTimeout(connectMongo, 15000);
    });
}
connectMongo();

// Graceful Process Termination Handlers
function gracefulShutdown(signal) {
  console.log(`Received ${signal}. Gracefully terminating PulseRoute Express server...`);
  for (const client of realtimeClients) {
    try {
      client.res.write('event: server_shutdown\ndata: {}\n\n');
      client.res.end();
    } catch {}
  }
  realtimeClients.clear();

  server.close(async () => {
    console.log('PulseRoute HTTP server closed.');
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close(false);
        console.log('MongoDB connection cleanly closed.');
      }
    } catch (e) {
      console.warn('MongoDB close error:', e.message);
    }
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Graceful shutdown timeout exceeded. Forcefully terminating.');
    process.exit(1);
  }, 10000).unref?.();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
