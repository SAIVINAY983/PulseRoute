import React, { useMemo, useRef, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, Ambulance, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight,
  BarChart3, Bell, Check, ChevronDown, CircleAlert, CircleCheck, CircleHelp,
  CircleX, Clock, Clock3, Command, Cpu, Database, Eye, FileText, Filter,
  Gauge, Globe, HeartPulse, Info, LayoutDashboard, LifeBuoy, LogOut,
  MapPinned, Menu, MoreHorizontal, Navigation, Pause, Play, Plus, Radio,
  RefreshCw, RotateCcw, Route, Search, Send, Server, Settings2, Shield,
  ShieldAlert, ShieldCheck, Signal, Siren, SlidersHorizontal, Sparkles,
  TrafficCone, TrendingUp, Users, X, Zap, BookOpen, AlertTriangle
} from 'lucide-react';
import './styles.css';
import {
  rankAmbulances, recommendPriority, getRouteConflicts, scoreAmbulance,
  DEFAULT_WEIGHTS, parseMinutes, parseKilometers
} from './priorityEngine.js';
import { runPulseRouteTestSuite } from './testSuite.js';
import LandingPage from './LandingPage.jsx';

const initialAmbulances = [
  { id: 'AMB-104', name: 'Unit 104', severity: 'Critical', patient: 'Cardiac arrest alert', eta: '04 min', distance: '2.1 km', speed: '42 km/h', route: 'North Avenue → City Hospital', destination: 'City Hospital', status: 'En Route', color: '#ff5b6e', waitingTime: 3, x: 20, y: 58, score: 96 },
  { id: 'AMB-208', name: 'Unit 208', severity: 'High', patient: 'Multi-vehicle collision', eta: '07 min', distance: '3.8 km', speed: '36 km/h', route: 'Market Road → Trauma Centre', destination: 'Trauma Centre', status: 'Assigned', color: '#f6b94a', waitingTime: 6, x: 48, y: 29, score: 82 },
  { id: 'AMB-315', name: 'Unit 315', severity: 'Medium', patient: 'Acute respiratory distress', eta: '11 min', distance: '6.4 km', speed: '31 km/h', route: 'University Road → General Hospital', destination: 'General Hospital', status: 'En Route', color: '#48d6b0', waitingTime: 2, x: 73, y: 71, score: 64 },
  { id: 'AMB-402', name: 'Unit 402', severity: 'Low', patient: 'Pediatric fracture stabilization', eta: '15 min', distance: '8.2 km', speed: '28 km/h', route: 'South Ring → West Clinic', destination: 'West Clinic', status: 'Available', color: '#5d9bff', waitingTime: 0, x: 15, y: 80, score: 42 },
  { id: 'AMB-510', name: 'Unit 510', severity: 'High', patient: 'Industrial burn trauma', eta: '02 min', distance: '1.2 km', speed: '0 km/h', route: 'East Gateway → Metro Burn Unit', destination: 'Metro Burn Unit', status: 'At Scene', color: '#f6b94a', waitingTime: 9, x: 82, y: 35, score: 88 },
  { id: 'AMB-101', name: 'Unit 101', severity: 'Moderate', patient: 'Routine surgical transfer', eta: '00 min', distance: '0.0 km', speed: '0 km/h', route: 'Central Corridor → City Hospital', destination: 'City Hospital', status: 'Completed', color: '#8495aa', waitingTime: 0, x: 34, y: 45, score: 50 },
];

const initialSignals = [
  { id: 'SIG-01', name: 'North Avenue / 5th St', state: 'Priority green', light: 'green', mode: 'Emergency override · AMB-104', activeAmbulanceId: 'AMB-104', recoveryStage: 'idle', x: 34, y: 45 },
  { id: 'SIG-02', name: 'Market Road / Central', state: 'Normal cycle', light: 'red', mode: 'Adaptive control', activeAmbulanceId: null, recoveryStage: 'idle', x: 61, y: 40 },
  { id: 'SIG-03', name: 'University Rd / Ring Rd', state: 'Normal cycle', light: 'green', mode: 'Adaptive control', activeAmbulanceId: null, recoveryStage: 'idle', x: 75, y: 59 },
  { id: 'SIG-04', name: 'Hospital Link / East Gate', state: 'Recovery phase', light: 'yellow', mode: 'Clearance check', activeAmbulanceId: null, recoveryStage: 'clearance', x: 47, y: 75 },
];

function App() {
  const [authenticated, setAuthenticated] = useState(Boolean(localStorage.getItem('pulseroute_token')));
  const [view, setView] = useState('landing'); // 'landing' | 'login' | 'dashboard'
  const [page, setPage] = useState('Overview'); // 'Overview' | 'Ambulances' | 'Priority Engine' | 'Traffic Signals' | 'Live Map' | 'Analytics' | 'Settings' | 'Help & support'
  const [apiStatus, setApiStatus] = useState('Connecting to API');
  const [authBusy, setAuthBusy] = useState(false);
  const [email, setEmail] = useState('operator@pulseroute.demo');
  const [password, setPassword] = useState('demo1234');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [ambs, setAmbs] = useState(initialAmbulances);
  const [signals, setSignals] = useState(initialSignals);
  const [running, setRunning] = useState(true);
  const [recoveryStage, setRecoveryStage] = useState('idle');
  const [realtimeStatus, setRealtimeStatus] = useState('offline'); // 'connected' | 'reconnecting' | 'offline'
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedEmergency, setSelectedEmergency] = useState(null);

  // Search & Filtering states for Fleet Management
  const [fleetSearch, setFleetSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [severityFilter, setSeverityFilter] = useState('All');

  // Modals & Inspection states
  const [showAdd, setShowAdd] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [factorInspectorUnit, setFactorInspectorUnit] = useState(null);
  const [toast, setToast] = useState('');

  // New emergency form state
  const [newSeverity, setNewSeverity] = useState('High');
  const [newLocation, setNewLocation] = useState('South Crossroad');
  const [newDestination, setNewDestination] = useState('City Hospital');
  const [newPatient, setNewPatient] = useState('Acute trauma emergency');

  // Settings & preferences
  const [settings, setSettings] = useState(() => {
    try {
      return { theme: 'dark', refreshInterval: 30, emergencyNotifications: true, alertSounds: false, ...JSON.parse(localStorage.getItem('pulseroute_settings') || '{}') };
    } catch {
      return { theme: 'dark', refreshInterval: 30, emergencyNotifications: true, alertSounds: false };
    }
  });
  const [systemPrefersLight, setSystemPrefersLight] = useState(() => window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');

  // Support & Diagnostics
  const [supportTab, setSupportTab] = useState('Guide');
  const [supportCategory, setSupportCategory] = useState('Bug / unexpected behavior');
  const [supportSeverity, setSupportSeverity] = useState('Normal');
  const [supportSubject, setSupportSubject] = useState('');
  const [supportDescription, setSupportDescription] = useState('');
  const [supportBusy, setSupportBusy] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');
  const [supportTicketId, setSupportTicketId] = useState('');
  const [health, setHealth] = useState({ loading: true, api: 'checking', database: 'checking', checkedAt: null, error: '' });
  const [qaResults, setQaResults] = useState(null);
  const [qaRunning, setQaRunning] = useState(false);
  const [qaFilter, setQaFilter] = useState('All');
  const [eventLog, setEventLog] = useState([
    { id: 1, time: '14:32:08', message: 'Priority engine initialized with deterministic heuristic', type: 'system' }
  ]);

  const previousAmbulanceIds = useRef(null);
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

  const runQaVerification = async () => {
    setQaRunning(true);
    try {
      const report = await runPulseRouteTestSuite({ apiBase: API_BASE, token: localStorage.getItem('pulseroute_token') });
      setQaResults(report);
      notify(`QA Suite: ${report.passed}/${report.total} tests passing (${report.durationMs}ms)`);
    } catch (err) {
      notify(`QA Suite Error: ${err.message}`);
    } finally {
      setQaRunning(false);
    }
  };

  const apiRequest = async (path, options = {}) => {
    const token = localStorage.getItem('pulseroute_token');
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
    return data;
  };

  const notify = (msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(''), 2800);
  };

  const effectiveTheme = settings.theme === 'system' ? (systemPrefersLight ? 'light' : 'dark') : settings.theme;

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!media) return undefined;
    const update = (e) => setSystemPrefersLight(e.matches);
    setSystemPrefersLight(media.matches);
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  // Priority evaluation & conflict detection
  const priority = useMemo(() => rankAmbulances(ambs, signals), [ambs, signals]);
  const recommendation = useMemo(() => recommendPriority(ambs, signals), [ambs, signals]);
  const routeConflicts = useMemo(() => getRouteConflicts(ambs, signals), [ambs, signals]);

  function logEvent(message, type = 'system') {
    const newEvent = {
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString('en-IN', { hour12: false }),
      message,
      type
    };
    setEventLog(prev => [newEvent, ...prev].slice(0, 50));
    if (localStorage.getItem('pulseroute_token')) {
      apiRequest('/api/events', { method: 'POST', body: JSON.stringify({ message, type }) }).catch(() => {});
    }
  }

  // Load dashboard data on auth
  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    async function loadDashboardData() {
      try {
        const [ambulances, signalData, events, notifs] = await Promise.all([
          apiRequest('/api/ambulances'),
          apiRequest('/api/signals'),
          apiRequest('/api/events'),
          apiRequest('/api/notifications').catch(() => [])
        ]);
        if (cancelled) return;
        if (ambulances?.length) setAmbs(ambulances);
        if (signalData?.length) setSignals(signalData);
        if (Array.isArray(notifs) && notifs.length) setNotifications(notifs);
        if (events?.length) {
          setEventLog(events.map((event, index) => ({
            id: event._id || index,
            time: new Date(event.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour12: false }),
            message: event.message,
            type: event.type || 'system'
          })));
        }
        setApiStatus('MongoDB connected');
      } catch (error) {
        if (!cancelled) {
          setApiStatus('API unavailable');
          notify(`Backend data could not load: ${error.message}`);
        }
      }
    }
    loadDashboardData();
    return () => { cancelled = true; };
  }, [authenticated]);

  // Real-Time EventSource Stream Connection (Native SSE with auto-reconnect & zero external deps)
  useEffect(() => {
    if (!authenticated) {
      setRealtimeStatus('offline');
      return undefined;
    }

    const token = localStorage.getItem('pulseroute_token') || 'demo_session_token';
    const streamUrl = `${API_BASE}/api/realtime/stream?token=${encodeURIComponent(token)}`;
    let es = null;
    let reconnectTimer = null;
    let isMounted = true;

    function initStream() {
      if (!isMounted) return;
      try {
        es = new EventSource(streamUrl);

        es.addEventListener('open', () => {
          if (isMounted) setRealtimeStatus('connected');
        });

        es.addEventListener('connected', () => {
          if (isMounted) setRealtimeStatus('connected');
        });

        es.addEventListener('emergency_created', (e) => {
          try {
            const created = JSON.parse(e.data);
            if (isMounted) {
              setAmbs(prev => {
                if (prev.some(a => a.id === created.id)) return prev;
                return [created, ...prev];
              });
              if (settings.emergencyNotifications) {
                notify(`Real-Time Alert: ${created.id} registered (${created.severity})`);
              }
            }
          } catch {}
        });

        es.addEventListener('ambulance_updated', (e) => {
          try {
            const updated = JSON.parse(e.data);
            if (isMounted) {
              setAmbs(prev => prev.map(a => a.id === updated.id ? { ...a, ...updated } : a));
              setSelectedEmergency(prev => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
            }
          } catch {}
        });

        es.addEventListener('signal_updated', (e) => {
          try {
            const updated = JSON.parse(e.data);
            if (isMounted) {
              setSignals(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s));
            }
          } catch {}
        });

        es.addEventListener('traffic_recovered', () => {
          if (isMounted) {
            setRecoveryStage('idle');
          }
        });

        es.addEventListener('notification', (e) => {
          try {
            const notif = JSON.parse(e.data);
            if (isMounted) {
              setNotifications(prev => {
                if (prev.some(n => n.id === notif.id)) return prev;
                return [notif, ...prev];
              });
              if (settings.emergencyNotifications && (notif.severity === 'Critical' || notif.category === 'Critical Alert')) {
                notify(`CRITICAL: ${notif.title}`);
              }
            }
          } catch {}
        });

        es.addEventListener('notification_read', (e) => {
          try {
            const { id } = JSON.parse(e.data);
            if (isMounted) {
              setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
            }
          } catch {}
        });

        es.addEventListener('notifications_cleared_unread', () => {
          if (isMounted) {
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
          }
        });

        es.addEventListener('notifications_wiped', () => {
          if (isMounted) {
            setNotifications([]);
          }
        });

        es.addEventListener('event_logged', (e) => {
          try {
            const event = JSON.parse(e.data);
            if (isMounted) {
              setEventLog(prev => [{
                id: event._id || event.id || Date.now(),
                time: new Date(event.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour12: false }),
                message: event.message,
                type: event.type || 'system'
              }, ...prev].slice(0, 50));
            }
          } catch {}
        });

        es.onerror = () => {
          if (isMounted) {
            setRealtimeStatus('reconnecting');
            if (es && es.readyState === 2) {
              es.close();
              reconnectTimer = setTimeout(initStream, 4000);
            }
          }
        };
      } catch {
        if (isMounted) {
          setRealtimeStatus('offline');
          reconnectTimer = setTimeout(initStream, 5000);
        }
      }
    }

    initStream();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (es) es.close();
      setRealtimeStatus('offline');
    };
  }, [authenticated, API_BASE, settings.emergencyNotifications]);

  // Health check polling
  useEffect(() => {
    if (!authenticated) return undefined;
    let cancelled = false;
    const checkHealth = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/health`, { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(`Health check returned ${response.status}`);
        if (!cancelled) {
          setHealth({
            loading: false,
            api: result.status === 'ok' ? 'online' : 'degraded',
            database: result.database || 'unknown',
            checkedAt: new Date(),
            error: ''
          });
        }
      } catch (error) {
        if (!cancelled) {
          setHealth({
            loading: false,
            api: 'offline',
            database: 'unknown',
            checkedAt: new Date(),
            error: error.message || 'Health check failed'
          });
        }
      }
    };
    checkHealth();
    const timer = window.setInterval(checkHealth, 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [authenticated, API_BASE]);

  // 30-Second Polling Fallback (Perseveres even if WebSocket/SSE drops)
  useEffect(() => {
    if (!authenticated) return undefined;
    let cancelled = false;
    const refresh = async () => {
      try {
        const [ambulances, signalData, events, notifs] = await Promise.all([
          apiRequest('/api/ambulances'),
          apiRequest('/api/signals'),
          apiRequest('/api/events'),
          apiRequest('/api/notifications').catch(() => [])
        ]);
        if (cancelled) return;
        const priorIds = previousAmbulanceIds.current;
        const currentIds = new Set(ambulances.map(a => a.id));
        if (priorIds && settings.emergencyNotifications && realtimeStatus === 'offline') {
          const incoming = ambulances.filter(a => !priorIds.has(a.id));
          if (incoming.length) notify(`New emergency request: ${incoming.map(a => a.id).join(', ')}`);
        }
        previousAmbulanceIds.current = currentIds;
        setAmbs(ambulances);
        setSignals(signalData);
        if (Array.isArray(notifs) && notifs.length) {
          setNotifications(notifs);
        }
        if (events?.length) {
          setEventLog(events.map((event, index) => ({
            id: event._id || index,
            time: new Date(event.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour12: false }),
            message: event.message,
            type: event.type || 'system'
          })));
        }
        setApiStatus('MongoDB connected');
      } catch {
        if (!cancelled) setApiStatus('API unavailable');
      }
    };
    const timer = window.setInterval(refresh, Number(settings.refreshInterval || 30) * 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [authenticated, settings.refreshInterval, settings.emergencyNotifications, realtimeStatus]);

  // Notification action handlers
  function markNotificationRead(id) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    apiRequest(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }).catch(() => {});
  }

  function markAllNotificationsRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    apiRequest('/api/notifications/read-all', { method: 'POST' }).catch(() => {});
    notify('All notifications marked as read');
  }

  function clearAllNotifications() {
    setNotifications([]);
    apiRequest('/api/notifications', { method: 'DELETE' }).catch(() => {});
    notify('Emergency notifications cleared');
  }

  const unreadNotifsCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  // Actions
  function grantPriority(id) {
    const ranked = rankAmbulances(ambs, signals);
    const selected = ranked.find(a => a.id === id);
    const current = ranked.find(a => a.status === 'Priority granted' && a.id !== id);
    if (!selected) return;

    if (current && current.score > selected.score && selected.severity !== 'Critical') {
      notify(`Conflict check: ${current.id} has higher priority score (${current.score} vs ${selected.score}).`);
      logEvent(`Priority request for ${id} held: ${current.id} ranks higher in conflict zone`, 'warning');
      return;
    }

    const targetSignalId = selected.targetSignalId || signals[0]?.id;
    setRecoveryStage('idle');
    setAmbs(prev => prev.map(a => ({
      ...a,
      status: a.id === id ? 'Priority granted' : a.status === 'Priority granted' ? 'En Route' : a.status
    })));
    setSignals(prev => prev.map(s => s.id === targetSignalId
      ? { ...s, light: 'green', state: 'Priority green', mode: `Emergency override · ${id}`, activeAmbulanceId: id }
      : s.state === 'Priority green' ? { ...s, light: 'yellow', state: 'Recovery phase', mode: 'Clearance check' } : s));

    apiRequest(`/api/ambulances/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'Priority granted' }) }).catch(() => {});
    if (targetSignalId) {
      apiRequest(`/api/signals/${encodeURIComponent(targetSignalId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ light: 'green', state: 'Priority green', mode: `Emergency override · ${id}`, activeAmbulanceId: id })
      }).catch(() => {});
    }

    logEvent(`${id} granted signal priority corridor at ${signals.find(s => s.id === targetSignalId)?.name || 'intersection'} (score ${selected.score}/100)`, 'priority');
    notify(`Priority corridor active for ${id} · score ${selected.score}/100`);
  }

  function recoverTraffic() {
    const activeSignal = signals.find(s => s.state === 'Priority green');
    const activeAmbulance = ambs.find(a => a.status === 'Priority granted');

    // Stage 1: initiate clearance check
    if (activeSignal && recoveryStage !== 'clearance') {
      setSignals(prev => prev.map(s => s.id === activeSignal.id
        ? { ...s, light: 'yellow', state: 'Recovery phase', mode: 'Clearance check', recoveryStage: 'clearance' }
        : s));
      setRecoveryStage('clearance');
      apiRequest(`/api/signals/${encodeURIComponent(activeSignal.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ light: 'yellow', state: 'Recovery phase', mode: 'Clearance check', recoveryStage: 'clearance' })
      }).catch(() => {});
      logEvent(`Stage 1: Clearance check initiated at ${activeSignal.id}${activeAmbulance ? ` for ${activeAmbulance.id}` : ''}`, 'recovery');
      notify('Clearance phase active · Confirm intersection is clear to restore normal adaptive cycle');
      return;
    }

    // Stage 2: explicit operator confirmation releases override
    setConfirmModal({
      title: 'Confirm Traffic Signal Recovery',
      message: 'Confirm that the emergency vehicle has safely cleared the intersection conflict zone. This will restore all signals to normal adaptive cycles.',
      warning: 'Premature recovery before vehicle clearance may lead to sudden green phases.',
      confirmText: 'Confirm Clearance & Restore',
      onConfirm: () => {
        setSignals(prev => prev.map(s => ({
          ...s,
          light: 'green',
          state: 'Normal cycle',
          mode: 'Adaptive control',
          activeAmbulanceId: null,
          recoveryStage: 'idle'
        })));
        setAmbs(prev => prev.map(a => a.status === 'Priority granted' ? { ...a, status: 'En Route' } : a));
        setRecoveryStage('idle');

        signals.forEach(s => apiRequest(`/api/signals/${encodeURIComponent(s.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ light: 'green', state: 'Normal cycle', mode: 'Adaptive control', activeAmbulanceId: null, recoveryStage: 'idle' })
        }).catch(() => {}));

        ambs.filter(a => a.status === 'Priority granted').forEach(a => apiRequest(`/api/ambulances/${encodeURIComponent(a.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'En Route' })
        }).catch(() => {}));

        logEvent('Stage 2: Clearance confirmed; emergency preemption released and adaptive signal timing restored', 'recovery');
        notify('Recovery confirmed · Traffic returned to normal adaptive cycle');
      }
    });
  }

  function advanceSimulatedRoute() {
    setAmbs(prev => prev.map(a => {
      if (['Completed', 'Available'].includes(a.status)) return a;
      const currentEta = parseMinutes(a.eta);
      const nextEta = Math.max(1, currentEta - 1);
      const currentDist = parseKilometers(a.distance);
      const nextDist = Math.max(0.3, (currentDist - 0.4)).toFixed(1);
      const nextX = Math.max(8, Math.min(92, (a.x ?? 50) + (Math.random() - 0.5) * 5));
      const nextY = Math.max(8, Math.min(92, (a.y ?? 50) + (Math.random() - 0.5) * 5));

      const updated = {
        ...a,
        eta: `0${nextEta} min`,
        distance: `${nextDist} km`,
        x: nextX,
        y: nextY
      };

      apiRequest(`/api/ambulances/${encodeURIComponent(a.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ eta: updated.eta, distance: updated.distance, x: nextX, y: nextY })
      }).catch(() => {});

      return updated;
    }));

    logEvent('Simulated telemetry: vehicles advanced along corridor routes', 'system');
    notify('Ambulance routes advanced · ETAs updated');
  }

  function markTopUnitAtScene() {
    const candidate = ambs.find(a => ['En Route', 'Assigned', 'Priority granted'].includes(a.status));
    if (!candidate) {
      notify('No active en-route ambulance to mark at scene');
      return;
    }
    setAmbs(prev => prev.map(a => a.id === candidate.id ? { ...a, status: 'At Scene', speed: '0 km/h', eta: '00 min' } : a));
    apiRequest(`/api/ambulances/${encodeURIComponent(candidate.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'At Scene', speed: '0 km/h', eta: '00 min' })
    }).catch(() => {});

    logEvent(`${candidate.id} arrived at emergency scene (${candidate.patient})`, 'status');
    notify(`${candidate.id} marked as arrived At Scene`);
  }

  function promptCompleteEmergency(unitId = null) {
    const target = unitId ? ambs.find(a => a.id === unitId) : ambs.find(a => ['At Scene', 'Priority granted', 'En Route'].includes(a.status));
    if (!target) {
      notify('No active emergency to complete');
      return;
    }

    setConfirmModal({
      title: `Complete Emergency Trip · ${target.id}`,
      message: `Are you sure you want to mark ${target.id} as Completed? This marks patient transfer complete and releases any corridor priority lock.`,
      warning: 'Completed ambulances are removed from active priority queues.',
      confirmText: 'Complete Emergency Trip',
      danger: true,
      onConfirm: () => {
        setAmbs(prev => prev.map(a => a.id === target.id ? { ...a, status: 'Completed', color: '#8495aa', speed: '0 km/h' } : a));
        apiRequest(`/api/ambulances/${encodeURIComponent(target.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'Completed', color: '#8495aa', speed: '0 km/h' })
        }).catch(() => {});

        // Release any active signal reserved for this unit
        setSignals(prev => prev.map(s => s.activeAmbulanceId === target.id
          ? { ...s, light: 'green', state: 'Normal cycle', mode: 'Adaptive control', activeAmbulanceId: null }
          : s));

        logEvent(`${target.id} completed emergency trip to ${target.destination || 'hospital'}`, 'status');
        notify(`${target.id} marked as Completed`);
      }
    });
  }

  function updateAmbulanceStatus(id, newStatus) {
    if (newStatus === 'Completed') {
      promptCompleteEmergency(id);
      return;
    }

    setAmbs(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    apiRequest(`/api/ambulances/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus })
    }).catch(() => {});

    logEvent(`${id} status updated to ${newStatus}`, 'status');
    notify(`${id} status updated to ${newStatus}`);
  }

  function recalculatePriorities() {
    const ranked = rankAmbulances(ambs, signals);
    setAmbs(ranked);
    logEvent('Priority engine: 100-point deterministic scores recalculated', 'system');
    notify('Priority scores recalculated using deterministic multi-factor rules');
  }

  async function addAmbulance(e) {
    e.preventDefault();
    const id = `AMB-${Math.floor(400 + Math.random() * 500)}`;
    const color = newSeverity === 'Critical' ? '#ff5b6e' : newSeverity === 'High' ? '#f6b94a' : newSeverity === 'Low' ? '#5d9bff' : '#48d6b0';
    const ambulance = {
      id,
      name: `Unit ${id.slice(4)}`,
      severity: newSeverity,
      patient: newPatient,
      destination: newDestination,
      eta: '06 min',
      distance: '3.2 km',
      speed: '38 km/h',
      route: `${newLocation} → ${newDestination}`,
      status: 'Assigned',
      color,
      waitingTime: 1,
      x: 16 + Math.random() * 65,
      y: 18 + Math.random() * 65
    };
    try {
      const saved = await apiRequest('/api/ambulances', { method: 'POST', body: JSON.stringify(ambulance) });
      setAmbs(prev => [saved, ...prev]);
      if (previousAmbulanceIds.current) previousAmbulanceIds.current.add(saved.id);
      setShowAdd(false);
      logEvent(`${saved.id} registered for dispatch (${newSeverity}) · ${newPatient}`, 'new');
      notify(`${saved.id} added to active dispatch queue`);
    } catch (error) {
      notify(`Could not save emergency: ${error.message}`);
    }
  }

  async function signIn(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { notify('Enter your operator email and password'); return; }
    setAuthBusy(true);
    try {
      const result = await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      localStorage.setItem('pulseroute_token', result.token);
      setEmail(result.user.email);
      setAuthenticated(true);
      setView('dashboard');
      setApiStatus('MongoDB connected');
      notify('Signed in securely · Command Center connected');
    } catch (error) {
      // Graceful demo fallback if backend is offline or unreachable
      if (email === 'operator@pulseroute.demo') {
        localStorage.setItem('pulseroute_token', 'demo_session_token');
        setEmail('operator@pulseroute.demo');
        setAuthenticated(true);
        setView('dashboard');
        setApiStatus('Simulation mode');
        notify('Signed into Command Center · Simulation mode active');
      } else {
        notify(error.message || 'Login failed. Check backend credentials.');
      }
    } finally {
      setAuthBusy(false);
    }
  }

  async function submitSupportTicket(e) {
    e.preventDefault();
    setSupportBusy(true);
    setSupportMessage('');
    setSupportTicketId('');
    try {
      const result = await apiRequest('/api/support/tickets', {
        method: 'POST',
        body: JSON.stringify({ category: supportCategory, severity: supportSeverity, subject: supportSubject.trim(), description: supportDescription.trim() })
      });
      setSupportTicketId(result.ticket?.ticketNumber || 'PR-TICKET');
      setSupportMessage('Your incident report was stored in MongoDB.');
      setSupportSubject('');
      setSupportDescription('');
      logEvent(`Support report submitted: ${result.ticket?.ticketNumber || 'Ticket created'}`, 'system');
    } catch (error) {
      setSupportMessage(`Could not save report: ${error.message}.`);
    } finally {
      setSupportBusy(false);
    }
  }

  async function saveSettings(e) {
    e?.preventDefault?.();
    setSettingsBusy(true);
    setSettingsMessage('');
    try {
      const saved = await apiRequest('/api/settings', { method: 'PUT', body: JSON.stringify(settings) });
      const next = { theme: 'dark', refreshInterval: 30, emergencyNotifications: true, alertSounds: false, ...saved };
      setSettings(next);
      localStorage.setItem('pulseroute_settings', JSON.stringify(next));
      setSettingsMessage('Settings saved to your PulseRoute account in MongoDB.');
      logEvent('Operator settings preferences updated', 'system');
    } catch (error) {
      localStorage.setItem('pulseroute_settings', JSON.stringify(settings));
      setSettingsMessage(`Preferences cached locally. Server note: ${error.message}`);
    } finally {
      setSettingsBusy(false);
    }
  }

  // Filtered ambulances for Fleet view
  const filteredFleet = ambs.filter(a => {
    const matchesSearch = `${a.id} ${a.name} ${a.patient} ${a.destination} ${a.route}`.toLowerCase().includes(fleetSearch.toLowerCase());
    const matchesStatus = statusFilter === 'All' || a.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesSeverity = severityFilter === 'All' || a.severity.toLowerCase() === severityFilter.toLowerCase();
    return matchesSearch && matchesStatus && matchesSeverity;
  });

  // Fleet stats
  const fleetStats = useMemo(() => {
    const total = ambs.length;
    const available = ambs.filter(a => a.status === 'Available').length;
    const assigned = ambs.filter(a => a.status === 'Assigned' || a.status === 'Awaiting priority').length;
    const enRoute = ambs.filter(a => a.status === 'En Route' || a.status === 'En route' || a.status === 'Priority granted' || a.status === 'Approaching').length;
    const atScene = ambs.filter(a => a.status === 'At Scene' || a.status === 'At scene').length;
    const completed = ambs.filter(a => a.status === 'Completed').length;
    const active = total - available - completed;
    const utilization = total > 0 ? Math.round((active / total) * 100) : 0;
    return { total, available, assigned, enRoute, atScene, completed, active, utilization };
  }, [ambs]);

  // Public Landing View
  if (view === 'landing') {
    return (
      <LandingPage
        onLaunchCommand={() => {
          if (authenticated) {
            setView('dashboard');
          } else {
            setView('login');
          }
        }}
        onOpenLogin={() => {
          if (authenticated) {
            setView('dashboard');
          } else {
            setView('login');
          }
        }}
        onOpenHelp={() => {
          setSupportTab('Guide');
          setPage('Help & support');
          if (authenticated) {
            setView('dashboard');
          } else {
            setView('login');
          }
        }}
        onOpenSettings={() => {
          setPage('Settings');
          if (authenticated) {
            setView('dashboard');
          } else {
            setView('login');
          }
        }}
        authenticated={authenticated}
      />
    );
  }

  // Login View
  if (view === 'login' || !authenticated) {
    return (
      <div className="login-shell">
        <div className="login-art">
          <div className="brand" style={{ cursor: 'pointer' }} onClick={() => setView('landing')} title="Return to PulseRoute Home">
            <div className="brand-mark"><Siren size={23}/></div>
            <span>Pulse<span className="brand-accent">Route</span></span>
          </div>
          <div className="login-message">
            <div className="eyebrow"><span className="pulse-dot"/> EMERGENCY RESPONSE INTELLIGENCE</div>
            <h1>Every second<br/>moves <span>someone</span><br/>closer to help.</h1>
            <p>Coordinate emergency vehicles, prioritize intersections, and recover city traffic — from one command center.</p>
            <div className="login-stats">
              <div><strong>06</strong><span>Fleet Units</span></div>
              <div><strong>04</strong><span>Connected Signals</span></div>
              <div><strong>100pt</strong><span>Scoring Model</span></div>
            </div>
          </div>
          <div className="art-grid">
            <div className="art-route route-one"/><div className="art-route route-two"/><div className="art-pin"><Ambulance size={22}/></div><div className="art-cross cross-one"><i/><i/><i/></div><div className="art-cross cross-two"><i/><i/><i/></div>
          </div>
          <div className="login-foot">
            <span><ShieldCheck size={14}/> Controlled demo environment</span>
            <span>© 2026 PulseRoute</span>
          </div>
        </div>
        <div className="login-panel">
          <form className="login-form" onSubmit={signIn}>
            <button
              type="button"
              className="text-button"
              onClick={() => setView('landing')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '16px', color: '#7ba0cd', cursor: 'pointer', fontSize: '12px' }}
            >
              <ArrowLeft size={14}/> Back to Landing Page
            </button>
            <div className="mobile-brand brand">
              <div className="brand-mark"><Siren size={22}/></div>
              <span>Pulse<span className="brand-accent">Route</span></span>
            </div>
            <div className="form-kicker">COMMAND CENTER ACCESS</div>
            <h2>Welcome back</h2>
            <p className="muted">Sign in to access your emergency operations dashboard.</p>
            <label htmlFor="email">Operator email</label>
            <div className="input-wrap"><Users size={17}/><input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@organization.com" required/></div>
            <label htmlFor="password">Password</label>
            <div className="input-wrap"><ShieldCheck size={17}/><input id="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password" required/></div>
            <div className="form-options">
              <label className="remember"><input type="checkbox" defaultChecked/> Remember me</label>
              <button type="button" className="text-button" onClick={()=>notify('Demo mode: prefilled demo operator credentials active.')}>Forgot password?</button>
            </div>
            <button className="primary-btn login-btn" type="submit" disabled={authBusy}>
              {authBusy ? 'Connecting…' : 'Enter command center'} <ArrowUpRight size={17}/>
            </button>
            <div
              className="demo-hint"
              style={{ cursor: 'pointer', transition: '0.15s' }}
              onClick={() => {
                localStorage.setItem('pulseroute_token', 'demo_session_token');
                setEmail('operator@pulseroute.demo');
                setAuthenticated(true);
                setView('dashboard');
                setApiStatus('Simulation mode');
                notify('Quick demo access granted · Command Center opened');
              }}
              title="Click here for instant demo operator access"
            >
              <Sparkles size={15}/>
              <span><strong>Operator Demo Account (Click for instant access)</strong><br/>operator@pulseroute.demo / demo1234</span>
            </div>
            <div className="login-security"><ShieldCheck size={14}/> Protected demo · No real dispatch connection</div>
          </form>
        </div>
        {toast && <div className="toast"><Check size={16}/>{toast}</div>}
      </div>
    );
  }

  // Primary Navigation
  const nav = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Ambulances', icon: Ambulance, count: ambs.length },
    { label: 'Priority Engine', icon: Sparkles, count: priority.length },
    { label: 'Traffic Signals', icon: TrafficCone, count: signals.length },
    { label: 'Live Map', icon: MapPinned },
    { label: 'Analytics', icon: BarChart3 },
  ];

  return (
    <div className="app-shell" data-theme={effectiveTheme}>
      {/* Sidebar */}
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="brand sidebar-brand">
          <div className="brand-mark" style={{ cursor: 'pointer' }} onClick={() => setView('landing')} title="Return to Landing Page">
            <Siren size={22}/>
          </div>
          <span style={{ cursor: 'pointer' }} onClick={() => setView('landing')} title="Return to Landing Page">
            Pulse<span className="brand-accent">Route</span>
          </span>
          <button className="mobile-close icon-btn" onClick={() => setMobileMenu(false)}><X size={18}/></button>
        </div>
        <div className="workspace">
          <div className="workspace-icon"><Command size={18}/></div>
          <div><strong>City Operations</strong><span>Emergency dispatch</span></div>
          <ChevronDown size={15}/>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          <button
            type="button"
            onClick={() => { setView('landing'); setMobileMenu(false); }}
            className="nav-item"
            title="Open Public Landing Page"
          >
            <Globe size={18} />
            <span>Public Portal</span>
            <ArrowUpRight size={13} style={{ marginLeft: 'auto', opacity: 0.6 }} />
          </button>
          {nav.map(item => (
            <button
              key={item.label}
              onClick={() => { setPage(item.label); setMobileMenu(false); }}
              className={`nav-item ${page === item.label ? 'active' : ''}`}
            >
              <item.icon size={18}/>
              <span>{item.label}</span>
              {typeof item.count === 'number' && <span className="nav-count">{item.count}</span>}
            </button>
          ))}
        </nav>
        <div className="nav-label system-label">SYSTEM</div>
        <button className={`nav-item ${page === 'Settings' ? 'active' : ''}`} onClick={() => { setPage('Settings'); setMobileMenu(false); setSettingsMessage(''); }}>
          <Settings2 size={18}/><span>Settings</span>
        </button>
        <button className={`nav-item ${page === 'Help & support' ? 'active' : ''}`} onClick={() => { setPage('Help & support'); setMobileMenu(false); }}>
          <CircleHelp size={18}/><span>Help & support</span>
        </button>
        <div className="sidebar-spacer"/>
        <div className="system-status">
          <div className="status-top"><span className="pulse-dot"/> SYSTEM OPERATIONAL</div>
          <div className="status-row"><span>Signal network</span><strong>4 Online</strong></div>
          <div className="status-row"><span>AI priority engine</span><strong>Deterministic</strong></div>
          <div className="status-bar"><span/></div>
          <div className="status-caption">{apiStatus} · Simulation mode</div>
        </div>
        <button className="profile-card" onClick={() => setShowProfile(!showProfile)}>
          <div className="avatar">OP</div>
          <div className="profile-info"><strong>Control Operator</strong><span>Dispatch administrator</span></div>
          <MoreHorizontal size={18}/>
        </button>
        {showProfile && (
          <div className="profile-pop">
            <strong>Operator session</strong><span>{email}</span>
            <button onClick={() => {
              localStorage.removeItem('pulseroute_token');
              setAuthenticated(false);
              setApiStatus('Disconnected');
              setShowProfile(false);
              setView('landing');
              notify('Signed out successfully');
            }}>
              <LogOut size={15}/> Sign out
            </button>
          </div>
        )}
      </aside>

      {/* Main Area */}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu icon-btn" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={20}/></button>
            <div>
              <div className="breadcrumb">Command Center <span>/</span> <strong>{page}</strong></div>
              <div className="page-heading">
                {page === 'Overview' ? 'Emergency operations overview' :
                 page === 'Ambulances' ? 'Ambulance fleet management' :
                 page === 'Priority Engine' ? 'Priority engine & conflict analysis' :
                 page === 'Traffic Signals' ? 'Intersection control & recovery' :
                 page === 'Live Map' ? 'Live operations map' :
                 page === 'Analytics' ? 'Emergency analytics & metrics' :
                 page === 'Settings' ? 'System settings' : 'Help & support'}
              </div>
            </div>
          </div>
          <div className="topbar-actions">
            {/* Real-time Connection Status Pill */}
            <div className={`realtime-pill ${realtimeStatus}`} title={`Real-Time event stream status: ${realtimeStatus}`}>
              <span className="realtime-dot" />
              <span>
                {realtimeStatus === 'connected' ? 'Real-Time: Connected' :
                 realtimeStatus === 'reconnecting' ? 'Reconnecting…' : 'Offline (30s Polling)'}
              </span>
            </div>

            {/* Connection Indicator */}
            <div className="network-pill" title="PulseRoute backend & database connection status">
              <span className="pulse-dot" style={{ background: health.database === 'connected' ? '#48d6b0' : '#ff5b6e' }}/>
              <span>DB: {health.database === 'connected' ? 'Connected' : 'Offline'}</span>
            </div>

            <button
              type="button"
              className="secondary-btn compact"
              onClick={() => setView('landing')}
              title="Return to Public Landing Page"
              style={{ gap: '6px', padding: '6px 11px', fontSize: '11px' }}
            >
              <Globe size={14}/> Landing Page
            </button>

            <div className="notif-btn-wrapper">
              <button
                className="icon-btn notification-btn"
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label="Emergency Notifications"
                title="Open Emergency Notification Center"
              >
                <Bell size={18}/>
                {settings.emergencyNotifications && unreadNotifsCount > 0 && (
                  <span className="notif-badge-count">{unreadNotifsCount > 9 ? '9+' : unreadNotifsCount}</span>
                )}
              </button>
            </div>

            <div className="top-avatar">OP</div>
          </div>
        </header>

        <div className="content-area">
          {/* Universal Live Simulation Control Bar */}
          <div className="sim-control-bar">
            <div className="sim-control-title">
              <span className="pulse-dot" />
              <span>LIVE SIMULATION CONTROLS</span>
            </div>
            <div className="sim-btn-group">
              <button className="sim-btn primary" onClick={() => setShowAdd(true)} title="Simulate a new emergency call">
                <Plus size={13} /> Simulate Emergency
              </button>
              <button className="sim-btn" onClick={recalculatePriorities} title="Recalculate transparent 100-point rankings">
                <Sparkles size={13} /> Recalculate Priorities
              </button>
              <button className="sim-btn cyan" onClick={advanceSimulatedRoute} title="Advance vehicles along route coordinates">
                <Navigation size={13} /> Advance Route
              </button>
              <button className="sim-btn" onClick={markTopUnitAtScene} title="Mark active ambulance as arrived at scene">
                <MapPinned size={13} /> Mark At Scene
              </button>
              <button className="sim-btn" onClick={() => promptCompleteEmergency()} title="Complete active emergency trip">
                <Check size={13} /> Complete Trip
              </button>
              <button className="sim-btn green" onClick={recoverTraffic} title="Trigger two-stage signal recovery cycle">
                <RefreshCw size={13} /> {recoveryStage === 'clearance' ? 'Confirm Recovery' : 'Trigger Recovery'}
              </button>
            </div>
          </div>

          {/* Route Conflict Warning Banner */}
          {routeConflicts.length > 0 && (
            <div className="conflict-alert-banner" role="alert">
              <div className="conflict-alert-icon">
                <AlertTriangle size={20} />
              </div>
              <div className="conflict-alert-content">
                <strong>Corridor Conflict Detected ({routeConflicts.length} Flagged)</strong>
                <p>
                  Multiple emergency vehicles are currently approaching shared intersection corridors.
                  Review the Priority Engine before granting preemption to avoid conflicting green assignments.
                </p>
              </div>
              <button className="secondary-btn compact" onClick={() => setPage('Priority Engine')} style={{ flexShrink: 0 }}>
                Inspect Conflicts <ArrowUpRight size={13} />
              </button>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {page === 'Overview' && (
            <>
              <section className="metric-grid">
                <Metric icon={Ambulance} label="Active fleet units" value={String(fleetStats.active).padStart(2, '0')} change={`${fleetStats.available} available for dispatch`} tone="red" trend="up"/>
                <Metric icon={Signal} label="Signals coordinated" value={`${signals.length}/${signals.length}`} change="All intersections operational" tone="blue"/>
                <Metric icon={Clock3} label="Avg. response ETA" value="06:48" change="Deterministic routing" tone="green" trend="down"/>
                <Metric icon={Gauge} label="Fleet utilization" value={`${fleetStats.utilization}%`} change={`${fleetStats.completed} trips completed`} tone="purple" trend="up"/>
              </section>

              <section className="main-grid">
                <div className="panel map-panel">
                  <div className="panel-header">
                    <div><h3>Live city map</h3><p>Ambulance routes & intersection status</p></div>
                    <div className="map-header-actions">
                      <span className="map-live"><span className="pulse-dot"/> LIVE</span>
                      <button className="icon-btn small" onClick={() => setPage('Live Map')} aria-label="Open full map"><ArrowUpRight size={17}/></button>
                    </div>
                  </div>
                  <TrafficMap ambs={ambs} signals={signals} running={running} onSelect={setSelectedEmergency}/>
                  <div className="map-legend">
                    <span><i className="legend-dot ambulance-dot"/> Critical</span>
                    <span><i className="legend-dot green-dot"/> Priority green</span>
                    <span><i className="legend-dot red-dot"/> Stop phase</span>
                    <span><i className="legend-dot yellow-dot"/> Clearance</span>
                  </div>
                </div>

                <div className="panel priority-panel">
                  <div className="panel-header">
                    <div><h3>Priority queue</h3><p>Deterministic 100-point emergency rankings</p></div>
                    <span className="count-badge">{priority.length} ranked</span>
                  </div>

                  <div className="ai-recommendation">
                    <div className="ai-rec-icon"><Sparkles size={16}/></div>
                    <div className="ai-rec-copy">
                      <span>NEXT PRIORITY CORRIDOR</span>
                      <strong>{recommendation ? `${recommendation.id} · ${recommendation.severity}` : 'No pending requests'}</strong>
                      <small>{recommendation ? `Score ${recommendation.score}/100 · ${recommendation.eta} ETA · ${recommendation.targetSignalName || 'Nearest signal'}` : 'All emergencies served'}</small>
                    </div>
                    {recommendation && (
                      <button className="ai-rec-action" onClick={() => grantPriority(recommendation.id)}>
                        Prioritize <ArrowUpRight size={13}/>
                      </button>
                    )}
                  </div>

                  <div className="queue-list">
                    {priority.slice(0, 4).map((a) => (
                      <div className="queue-item" key={a.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedEmergency(a)} title="Open 7-stage event timeline & emergency details">
                        <div className={`severity-indicator ${a.severity.toLowerCase()}`}/>
                        <div className="queue-main">
                          <div className="queue-title">
                            <strong>{a.id}</strong>
                            <span className={`severity-tag ${a.severity.toLowerCase()}`}>{a.severity}</span>
                            <span style={{ fontSize: '9px', color: '#7a91aa', marginLeft: 'auto' }}>{a.status}</span>
                          </div>
                          <span className="queue-desc">{a.patient}</span>
                          <div className="queue-meta">
                            <span><Clock3 size={12}/> {a.eta} ETA</span>
                            <span><Navigation size={12}/> {a.distance}</span>
                            <span><HospitalIcon size={12}/> {a.destination || 'City Hospital'}</span>
                          </div>
                        </div>
                        <div className="score-box" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setFactorInspectorUnit(a); }} title="Inspect score factors">
                          <strong>{a.score}</strong>
                          <span>score</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="panel-link" onClick={() => setPage('Priority Engine')}>
                    View priority engine & factor breakdown <ArrowUpRight size={15}/>
                  </button>
                </div>
              </section>

              <section className="bottom-grid">
                <div className="panel ambulance-panel">
                  <div className="panel-header">
                    <div><h3>Active fleet dispatch</h3><p>Current operational units</p></div>
                    <button className="panel-link inline-link" onClick={() => setPage('Ambulances')}>Manage all fleet <ArrowUpRight size={14}/></button>
                  </div>
                  <AmbulanceTable ambs={priority.slice(0, 4)} onPriority={grantPriority} onStatusChange={updateAmbulanceStatus} onInspect={setFactorInspectorUnit} onSelect={setSelectedEmergency} />
                </div>

                <div className="panel signals-panel">
                  <div className="panel-header">
                    <div><h3>Intersection status</h3><p>Connected municipal controllers</p></div>
                    <span className="signal-count"><span className="pulse-dot"/> {signals.length} online</span>
                  </div>
                  <div className="signal-list">
                    {signals.slice(0, 4).map(s => <SignalRow key={s.id} signal={s}/>)}
                  </div>
                  <button className="panel-link" onClick={() => setPage('Traffic Signals')}>
                    Open intersection control & recovery <ArrowUpRight size={15}/>
                  </button>
                </div>
              </section>
            </>
          )}

          {/* TAB 2: AMBULANCES (Dedicated Fleet Management) */}
          {page === 'Ambulances' && (
            <section className="panel" style={{ padding: '20px' }}>
              <div className="panel-header" style={{ padding: '0 0 16px' }}>
                <div>
                  <h3 style={{ fontSize: '15px' }}>Ambulance Fleet Management</h3>
                  <p>Track, assign, transition statuses, and complete emergency trips across all fleet vehicles.</p>
                </div>
                <button className="primary-btn" onClick={() => setShowAdd(true)}>
                  <Plus size={16}/> New Emergency
                </button>
              </div>

              {/* Fleet status summary counters */}
              <div className="status-donut-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)', marginBottom: '18px' }}>
                <div className="status-stat-box"><strong>{fleetStats.total}</strong><span>Total Fleet</span></div>
                <div className="status-stat-box" style={{ borderColor: '#204060' }}><strong style={{ color: '#5d9bff' }}>{fleetStats.available}</strong><span>Available</span></div>
                <div className="status-stat-box" style={{ borderColor: '#344059' }}><strong style={{ color: '#a4b7cf' }}>{fleetStats.assigned}</strong><span>Assigned</span></div>
                <div className="status-stat-box" style={{ borderColor: '#204d44' }}><strong style={{ color: '#48d6b0' }}>{fleetStats.enRoute}</strong><span>En Route</span></div>
                <div className="status-stat-box" style={{ borderColor: '#523a1a' }}><strong style={{ color: '#f6b94a' }}>{fleetStats.atScene}</strong><span>At Scene</span></div>
                <div className="status-stat-box" style={{ borderColor: '#222f3e' }}><strong style={{ color: '#7a8d9e' }}>{fleetStats.completed}</strong><span>Completed</span></div>
              </div>

              {/* Filter Toolbar */}
              <div className="fleet-toolbar">
                <div className="search-box" style={{ minWidth: '240px' }}>
                  <Search size={15}/>
                  <input
                    placeholder="Search by ID, patient, destination..."
                    value={fleetSearch}
                    onChange={e => setFleetSearch(e.target.value)}
                    style={{ width: '100%' }}
                  />
                  {fleetSearch && <button type="button" className="text-button" onClick={() => setFleetSearch('')}><X size={13}/></button>}
                </div>

                <div className="filter-group">
                  <span className="filter-label">Status:</span>
                  {['All', 'Available', 'Assigned', 'En Route', 'At Scene', 'Completed'].map(st => (
                    <button
                      key={st}
                      type="button"
                      className={`filter-pill ${statusFilter === st ? 'active' : ''}`}
                      onClick={() => setStatusFilter(st)}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <div className="filter-group">
                  <span className="filter-label">Severity:</span>
                  {['All', 'Critical', 'High', 'Medium', 'Low'].map(sev => (
                    <button
                      key={sev}
                      type="button"
                      className={`filter-pill ${severityFilter === sev ? 'active' : ''}`}
                      onClick={() => setSeverityFilter(sev)}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              {/* Detailed Ambulances Table */}
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>AMBULANCE</th>
                      <th>SEVERITY</th>
                      <th>PATIENT EMERGENCY</th>
                      <th>DESTINATION HOSPITAL</th>
                      <th>ETA / DIST</th>
                      <th>STATUS</th>
                      <th>TRANSITION STATUS</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFleet.map(a => (
                      <tr key={a.id}>
                        <td style={{ cursor: 'pointer' }} onClick={() => setSelectedEmergency(a)} title="Click to view 7-stage event timeline & details">
                          <div className="unit-cell">
                            <span className="unit-icon" style={{ borderColor: a.color, color: a.color }}>
                              <Ambulance size={16}/>
                            </span>
                            <div>
                              <strong>{a.id}</strong>
                              <span>{a.name}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`severity-tag ${a.severity.toLowerCase()}`}>
                            <i/> {a.severity}
                          </span>
                        </td>
                        <td style={{ cursor: 'pointer' }} onClick={() => setSelectedEmergency(a)} title="Click to view emergency details">
                          <span style={{ fontSize: '10px', color: '#e0e8f2' }}>{a.patient}</span>
                        </td>
                        <td>
                          <div className="route-cell">
                            <strong>{a.destination || 'City Hospital'}</strong>
                            <span>{a.route}</span>
                          </div>
                        </td>
                        <td>
                          <strong className="eta-value">{a.eta}</strong>
                          <span className="table-sub">{a.distance} · {a.speed}</span>
                        </td>
                        <td>
                          <span className={`status-tag ${a.status.toLowerCase().replaceAll(' ', '-')}`}>
                            <i/> {a.status}
                          </span>
                        </td>
                        <td>
                          <select
                            value={a.status}
                            onChange={e => updateAmbulanceStatus(a.id, e.target.value)}
                            aria-label={`Status for ${a.id}`}
                            style={{ background: '#0e1b2b', color: '#c7d6e8', border: '1px solid #283e58', borderRadius: 5, padding: '4px 6px', fontSize: '9px' }}
                          >
                            <option value="Available">Available</option>
                            <option value="Assigned">Assigned</option>
                            <option value="En Route">En Route</option>
                            <option value="At Scene">At Scene</option>
                            <option value="Completed">Completed</option>
                          </select>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              className={`action-btn ${a.status === 'Priority granted' ? 'granted' : ''}`}
                              onClick={() => grantPriority(a.id)}
                              disabled={a.status === 'Completed' || a.status === 'Available'}
                              title="Grant signal priority corridor"
                            >
                              {a.status === 'Priority granted' ? <><Check size={12}/> Granted</> : <>Prioritize <ArrowUpRight size={12}/></>}
                            </button>
                            <button
                              className="action-btn"
                              onClick={() => setSelectedEmergency(a)}
                              title="Open 7-stage event timeline & emergency details"
                            >
                              <FileText size={12}/> Details
                            </button>
                            <button
                              className="action-btn"
                              onClick={() => setFactorInspectorUnit(scoreAmbulance(a, ambs, signals))}
                              title="Inspect 100-point priority factors"
                            >
                              <Eye size={12}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredFleet.length === 0 && (
                  <div className="empty-state">
                    No ambulance fleet records match your current filters.
                    <br/>
                    <button className="secondary-btn compact" onClick={() => { setFleetSearch(''); setStatusFilter('All'); setSeverityFilter('All'); }} style={{ marginTop: 10 }}>
                      Reset filters
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* TAB 3: PRIORITY ENGINE */}
          {page === 'Priority Engine' && (
            <section className="panel" style={{ padding: '20px' }}>
              <div className="panel-header" style={{ padding: '0 0 16px' }}>
                <div>
                  <h3 style={{ fontSize: '15px' }}>Deterministic Emergency Priority Engine</h3>
                  <p>Transparent, explainable 100-point scoring algorithm. Not a black-box AI model.</p>
                </div>
                <button className="secondary-btn compact" onClick={recalculatePriorities}>
                  <RefreshCw size={13}/> Recalculate
                </button>
              </div>

              {/* Scoring Factors Explanation Grid */}
              <div className="factor-grid" style={{ marginBottom: '22px' }}>
                <Factor label="Clinical Severity" value={40} color="red" desc="Critical (40) · High (28) · Medium (18) · Low (8)" />
                <Factor label="ETA to Intersection" value={25} color="blue" desc="Shorter arrival time receives up to 25 pts" />
                <Factor label="Distance Proximity" value={15} color="green" desc="Immediate proximity receives up to 15 pts" />
                <Factor label="Queue Waiting Time" value={10} color="purple" desc="Wait duration boost up to 10 pts" />
              </div>

              {/* Tie-breaking rule explainer */}
              <div style={{ background: '#0e1b2b', border: '1px solid #1e324a', borderRadius: 8, padding: '12px 16px', marginBottom: '20px', fontSize: '10px', color: '#9bb0c7', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={18} style={{ color: '#48d6b0', flexShrink: 0 }} />
                <span>
                  <strong>Deterministic Tie-Breaking Hierarchy:</strong> If two emergencies have equal scores, ties are resolved in order: (1) Clinical Severity Rank &rarr; (2) Shorter ETA &rarr; (3) Shorter Distance &rarr; (4) Alphabetical Unit ID.
                </span>
              </div>

              {/* Ranked Queue Table with Factor Inspector */}
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>RANK</th>
                      <th>UNIT / PATIENT</th>
                      <th>SEVERITY</th>
                      <th>SCORE</th>
                      <th>FACTORS (SEV / ETA / DIST / WAIT / SIGNAL)</th>
                      <th>TARGET SIGNAL</th>
                      <th>CONFLICT STATUS</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {priority.map((a, idx) => {
                      const breakdown = a.scoreBreakdown || {};
                      return (
                        <tr key={a.id}>
                          <td>
                            <strong style={{ fontSize: '11px', color: idx === 0 ? '#ff5b6e' : idx === 1 ? '#f6b94a' : '#94a7bd' }}>
                              #{idx + 1}
                            </strong>
                          </td>
                          <td>
                            <div className="unit-cell">
                              <div>
                                <strong>{a.id}</strong>
                                <span>{a.patient}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`severity-tag ${a.severity.toLowerCase()}`}><i/> {a.severity}</span>
                          </td>
                          <td>
                            <strong style={{ fontSize: '13px', color: a.score >= 80 ? '#ff5b6e' : a.score >= 60 ? '#f6b94a' : '#48d6b0' }}>
                              {a.score}/100
                            </strong>
                          </td>
                          <td>
                            <div style={{ fontSize: '9px', color: '#8aa0b7' }}>
                              <span style={{ color: '#ff8491' }}>+{breakdown.severity?.points || 0}</span> / 
                              <span style={{ color: '#73a9ff' }}> +{breakdown.eta?.points || 0}</span> / 
                              <span style={{ color: '#56ddb9' }}> +{breakdown.distance?.points || 0}</span> / 
                              <span style={{ color: '#ba9bf8' }}> +{breakdown.waiting?.points || 0}</span> / 
                              <span style={{ color: '#90a4bb' }}> +{breakdown.readiness?.points || 0}</span>
                              {breakdown.conflictPenalty?.points < 0 && (
                                <span style={{ color: '#ff6274' }}> ({breakdown.conflictPenalty.points})</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: '9px', color: '#c7d6e8' }}>{a.targetSignalName || a.targetSignalId || 'Nearest node'}</span>
                          </td>
                          <td>
                            {a.hasConflict ? (
                              <span className="conflict-badge-critical">
                                <AlertTriangle size={11} /> Conflict flagged
                              </span>
                            ) : (
                              <span style={{ fontSize: '9px', color: '#48d6b0' }}>Clear corridor</span>
                            )}
                          </td>
                          <td>
                            <button className="action-btn" onClick={() => setFactorInspectorUnit(a)}>
                              <Eye size={12}/> Breakdown
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* TAB 4: TRAFFIC SIGNALS & RECOVERY */}
          {page === 'Traffic Signals' && (
            <section className="panel" style={{ padding: '20px' }}>
              <div className="panel-header" style={{ padding: '0 0 16px' }}>
                <div>
                  <h3 style={{ fontSize: '15px' }}>Traffic Signal Control & Recovery</h3>
                  <p>Intersection signal monitoring with two-stage post-clearance recovery verification.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="primary-btn" onClick={recoverTraffic}>
                    <RefreshCw size={14}/> {recoveryStage === 'clearance' ? 'Confirm Clearance & Restore' : 'Start Clearance Check'}
                  </button>
                </div>
              </div>

              {/* Signals Grid */}
              <div className="signals-grid-view">
                {signals.map(s => {
                  const assignedUnit = ambs.find(a => a.id === s.activeAmbulanceId);
                  const isPriority = s.state === 'Priority green';
                  const isClearance = s.state === 'Recovery phase';

                  return (
                    <div className="signal-card" key={s.id} style={{ borderColor: isPriority ? '#295b4c' : isClearance ? '#665026' : '#1e3146' }}>
                      <div className="signal-card-header">
                        <div className="signal-card-title">
                          <strong>{s.name}</strong>
                          <span>ID: {s.id} · GPS: ({s.x}, {s.y})</span>
                        </div>
                        <span className={`signal-stage-pill ${isPriority ? 'priority' : isClearance ? 'clearance' : 'normal'}`}>
                          {isPriority ? 'Priority Granted' : isClearance ? 'Clearance Pending' : 'Recovery Completed'}
                        </span>
                      </div>

                      {/* Visual light head graphic */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', background: '#08121f', padding: '12px', borderRadius: 8 }}>
                        <div className={`traffic-light ${s.light}`}>
                          <i style={{ background: s.light === 'red' ? '#ff5b6e' : '#334152', boxShadow: s.light === 'red' ? '0 0 8px #ff5b6e' : 'none' }} />
                          <i style={{ background: s.light === 'yellow' ? '#f6b94a' : '#334152', boxShadow: s.light === 'yellow' ? '0 0 8px #f6b94a' : 'none' }} />
                          <i style={{ background: s.light === 'green' ? '#48d6b0' : '#334152', boxShadow: s.light === 'green' ? '0 0 8px #48d6b0' : 'none' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: s.light === 'green' ? '#48d6b0' : s.light === 'yellow' ? '#f6b94a' : '#ff7484' }}>
                            {s.state}
                          </div>
                          <div style={{ fontSize: '9px', color: '#7a8e9e', marginTop: 2 }}>
                            Mode: {s.mode}
                          </div>
                        </div>
                      </div>

                      <div style={{ fontSize: '10px', color: '#97aabf' }}>
                        <strong>Active Priority Vehicle:</strong>{' '}
                        {assignedUnit ? (
                          <span style={{ color: assignedUnit.color, fontWeight: 600 }}>
                            {assignedUnit.id} ({assignedUnit.severity}) · {assignedUnit.patient}
                          </span>
                        ) : (
                          <span style={{ color: '#687e94' }}>No emergency override active</span>
                        )}
                      </div>

                      <div className="signal-card-actions">
                        <button
                          className="secondary-btn compact"
                          onClick={() => {
                            setSignals(prev => prev.map(x => x.id === s.id ? { ...x, light: 'green', state: 'Normal cycle', mode: 'Adaptive control', activeAmbulanceId: null } : x));
                            apiRequest(`/api/signals/${encodeURIComponent(s.id)}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ light: 'green', state: 'Normal cycle', mode: 'Adaptive control', activeAmbulanceId: null })
                            }).catch(() => {});
                            logEvent(`${s.id} restored to normal adaptive cycle`, 'recovery');
                            notify(`${s.id} restored`);
                          }}
                        >
                          <Check size={12}/> Normal Cycle
                        </button>
                        <button
                          className="secondary-btn compact"
                          onClick={() => {
                            setSignals(prev => prev.map(x => x.id === s.id ? { ...x, light: 'yellow', state: 'Recovery phase', mode: 'Clearance check' } : x));
                            apiRequest(`/api/signals/${encodeURIComponent(s.id)}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ light: 'yellow', state: 'Recovery phase', mode: 'Clearance check' })
                            }).catch(() => {});
                            logEvent(`${s.id} transitioned to yellow clearance check`, 'recovery');
                            notify(`${s.id} clearance initiated`);
                          }}
                        >
                          <RefreshCw size={12}/> Clearance
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Event Log for State Transitions */}
              <div className="panel" style={{ marginTop: '16px' }}>
                <div className="panel-header">
                  <div><h3>Intersection State Transition Log</h3><p>Auditable log of signal overrides and recovery cycles</p></div>
                  <span className="count-badge">{eventLog.filter(e => e.type === 'recovery' || e.type === 'priority').length} transitions</span>
                </div>
                <div className="event-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {eventLog.filter(e => e.type === 'recovery' || e.type === 'priority').map(e => (
                    <div className="event-row" key={e.id}>
                      <span className={`event-icon ${e.type}`}><TrafficCone size={13}/></span>
                      <div><strong>{e.message}</strong><span>{e.time}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* TAB 5: LIVE MAP */}
          {page === 'Live Map' && (
            <section className="panel full-map-panel">
              <div className="panel-header">
                <div><h3>Live City Operations Map</h3><p>Simulated metro traffic grid · GPS telemetry simulation</p></div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="secondary-btn compact" onClick={() => setRunning(!running)}>
                    {running ? <Pause size={14}/> : <Play size={14}/>} {running ? 'Pause Simulation' : 'Resume Simulation'}
                  </button>
                  <button className="secondary-btn compact" onClick={advanceSimulatedRoute}>
                    <Navigation size={14}/> Step Routes
                  </button>
                </div>
              </div>
              <TrafficMap ambs={ambs} signals={signals} running={running} large onSelect={setSelectedEmergency}/>
              <div className="map-legend">
                <span><i className="legend-dot ambulance-dot"/> Ambulance</span>
                <span><i className="legend-dot green-dot"/> Priority green</span>
                <span><i className="legend-dot red-dot"/> Stop phase</span>
                <span><i className="legend-dot yellow-dot"/> Clearance</span>
              </div>
              <div className="unit-focus-grid">
                {ambs.map(a => (
                  <div className="unit-focus" key={a.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedEmergency(a)} title="Open emergency details & event timeline">
                    <div className="unit-focus-top">
                      <span className="unit-mini-icon"><Ambulance size={17}/></span>
                      <strong>{a.id}</strong>
                      <span className={`severity-tag ${a.severity.toLowerCase()}`}>{a.severity}</span>
                      <span style={{ fontSize: '9px', color: '#7a8e9e', marginLeft: 'auto' }}>{a.status}</span>
                    </div>
                    <p>{a.route} &rarr; <strong>{a.destination || 'City Hospital'}</strong></p>
                    <div className="unit-focus-bottom">
                      <span><Clock3 size={13}/> {a.eta} ETA · {a.distance}</span>
                      <button onClick={(e) => { e.stopPropagation(); grantPriority(a.id); }}>Prioritize <ArrowUpRight size={13}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* TAB 6: ANALYTICS */}
          {page === 'Analytics' && (
            <section>
              <div className="metric-grid" style={{ marginBottom: '18px' }}>
                <Metric icon={Activity} label="Active emergencies" value={String(fleetStats.active).padStart(2, '0')} change="Queue monitored" tone="red" />
                <Metric icon={Gauge} label="Fleet utilization" value={`${fleetStats.utilization}%`} change={`${fleetStats.available} units available`} tone="blue" />
                <Metric icon={Clock3} label="Avg. response time" value="06.8m" change="Simulated baseline" tone="green" />
                <Metric icon={TrafficCone} label="Priority grants" value={String(eventLog.filter(e => e.type === 'priority').length).padStart(2, '0')} change="Intersection preemption" tone="purple" />
              </div>

              <div className="analytics-grid">
                {/* Emergency counts by severity */}
                <div className="chart-card">
                  <div className="chart-title">
                    <span>Emergency Counts by Severity</span>
                    <span style={{ fontSize: '9px', color: '#68829c' }}>Simulated Data</span>
                  </div>
                  <div className="severity-bars">
                    {[
                      { sev: 'Critical', count: ambs.filter(a => a.severity === 'Critical').length, color: 'critical' },
                      { sev: 'High', count: ambs.filter(a => a.severity === 'High').length, color: 'high' },
                      { sev: 'Medium', count: ambs.filter(a => a.severity === 'Medium' || a.severity === 'Moderate').length, color: 'medium' },
                      { sev: 'Low', count: ambs.filter(a => a.severity === 'Low').length, color: 'low' },
                    ].map(item => {
                      const pct = ambs.length > 0 ? Math.round((item.count / ambs.length) * 100) : 0;
                      return (
                        <div className="sev-bar-row" key={item.sev}>
                          <div className="sev-bar-label">
                            <span>{item.sev}</span>
                            <strong>{item.count} units ({pct}%)</strong>
                          </div>
                          <div className="sev-bar-track">
                            <div className={`sev-bar-fill ${item.color}`} style={{ width: `${Math.max(8, pct)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Fleet status breakdown */}
                <div className="chart-card">
                  <div className="chart-title">
                    <span>Ambulance Fleet Status Breakdown</span>
                    <span style={{ fontSize: '9px', color: '#68829c' }}>{ambs.length} Total Registered</span>
                  </div>
                  <div className="status-donut-grid">
                    <div className="status-stat-box"><strong>{fleetStats.available}</strong><span>Available</span></div>
                    <div className="status-stat-box"><strong>{fleetStats.assigned}</strong><span>Assigned</span></div>
                    <div className="status-stat-box"><strong>{fleetStats.enRoute}</strong><span>En Route</span></div>
                    <div className="status-stat-box"><strong>{fleetStats.atScene}</strong><span>At Scene</span></div>
                    <div className="status-stat-box"><strong>{fleetStats.completed}</strong><span>Completed</span></div>
                    <div className="status-stat-box"><strong>{signals.length}</strong><span>Signals</span></div>
                  </div>
                  <div style={{ marginTop: '16px', fontSize: '10px', color: '#7a8e9e', lineHeight: 1.6 }}>
                    All metrics reflect stored MongoDB state and deterministic simulation events.
                  </div>
                </div>
              </div>

              {/* Event Timeline Table */}
              <div className="panel" style={{ padding: '16px' }}>
                <div className="panel-header" style={{ padding: '0 0 14px' }}>
                  <div><h3>Recent Decision & Dispatch Events</h3><p>MongoDB persisted audit events</p></div>
                  <span className="count-badge">{eventLog.length} recorded</span>
                </div>
                <div className="event-list" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                  {eventLog.map(e => (
                    <div className="event-row" key={e.id}>
                      <span className={`event-icon ${e.type}`}><Activity size={13}/></span>
                      <div><strong>{e.message}</strong><span>{e.time}</span></div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* TAB 7: SETTINGS */}
          {page === 'Settings' && (
            <section className="settings-layout">
              <form className="panel settings-panel" onSubmit={saveSettings}>
                <div className="panel-header"><div><h3>Appearance</h3><p>Choose how PulseRoute looks on this device.</p></div><span className="settings-icon"><Settings2 size={18}/></span></div>
                <div className="settings-row"><div><strong>Theme</strong><span>Dark is recommended for emergency operations centers.</span></div><select value={settings.theme} onChange={e=>setSettings(prev=>({...prev,theme:e.target.value}))} aria-label="Dashboard theme"><option value="dark">Dark navy</option><option value="light">Light</option><option value="system">Use system preference</option></select></div>
                <div className="settings-row"><div><strong>Dashboard refresh</strong><span>How often ambulance, signal, and event data is fetched from the API.</span></div><select value={settings.refreshInterval} onChange={e=>setSettings(prev=>({...prev,refreshInterval:Number(e.target.value)}))} aria-label="Refresh interval"><option value="10">Every 10 seconds</option><option value="30">Every 30 seconds</option><option value="60">Every 60 seconds</option></select></div>
                <div className="panel-header settings-section-header"><div><h3>Notifications</h3><p>Choose which operator alerts are enabled.</p></div></div>
                <label className="settings-toggle"><span className="toggle-copy"><strong>Emergency notifications</strong><span>Show an in-app alert when a new ambulance request appears during refresh.</span></span><input type="checkbox" checked={settings.emergencyNotifications} onChange={e=>setSettings(prev=>({...prev,emergencyNotifications:e.target.checked}))}/><span className="toggle-ui"/></label>
                <div className="settings-toggle settings-toggle-disabled"><span className="toggle-copy"><strong>Alert sounds</strong><span>Not available in this version. Sound is off.</span></span><input type="checkbox" checked={false} disabled readOnly aria-label="Alert sounds unavailable"/><span className="toggle-ui" aria-hidden="true"/></div>
                <div className="settings-footer"><span className="settings-save-message" role="status">{settingsMessage || 'Preferences are stored per operator in MongoDB, with a browser cache for fallback.'}</span><button className="primary-btn" type="submit" disabled={settingsBusy}>{settingsBusy?<RefreshCw size={15} className="spin-icon"/>:<Check size={15}/>} {settingsBusy?'Saving…':'Save settings'}</button></div>
              </form>
              <div className="panel settings-info"><div className="panel-header"><div><h3>Current configuration</h3><p>Settings currently applied to this session.</p></div></div><div className="settings-summary"><div><span>Theme applied</span><strong>{effectiveTheme==='light'?'Light':'Dark navy'}</strong></div><div><span>Refresh interval</span><strong>{settings.refreshInterval} seconds</strong></div><div><span>Emergency alerts</span><strong>{settings.emergencyNotifications?'Enabled':'Disabled'}</strong></div><div><span>Alert audio</span><strong>Off · unavailable in this version</strong></div><div><span>API status</span><strong>{apiStatus}</strong></div></div><p className="settings-note">PulseRoute is a simulation prototype. Refresh and notification settings affect this browser session; they do not control real traffic signals or emergency services.</p></div>
            </section>
          )}

          {/* TAB 8: HELP & SUPPORT */}
          {page === 'Help & support' && (
            <section className="support-page">
              <div className="support-tabs" role="tablist" aria-label="Help and support sections">
                {[['Guide', BookOpen], ['System status', Activity], ['QA & Verification', ShieldCheck], ['Report a problem', LifeBuoy], ['About', Info]].map(([tab, Icon]) => (
                  <button type="button" role="tab" aria-selected={supportTab === tab} key={tab} className={`support-tab ${supportTab === tab ? 'active' : ''}`} onClick={() => setSupportTab(tab)}>
                    <Icon size={16}/>{tab}
                  </button>
                ))}
              </div>

              {supportTab === 'Guide' && (
                <div className="support-grid">
                  <article className="panel support-card support-guide-main">
                    <div className="panel-header"><div><h3>Operator Quick Guide</h3><p>Core workflows in the PulseRoute Command Center.</p></div><span className="settings-icon"><BookOpen size={18}/></span></div>
                    <div className="guide-steps">
                      <div className="guide-step"><span>01</span><div><strong>Monitor the Overview</strong><p>Review active ambulance requests, signal states, and deterministic priority queue rankings.</p></div></div>
                      <div className="guide-step"><span>02</span><div><strong>Manage Ambulance Fleet</strong><p>Assign units, transition lifecycle status (Assigned &rarr; En Route &rarr; At Scene &rarr; Completed), and complete trips with confirmation.</p></div></div>
                      <div className="guide-step"><span>03</span><div><strong>Evaluate Priority Engine</strong><p>Inspect explainable factors: Severity (40%), ETA (25%), Distance (15%), Waiting Time (10%), Signal Readiness (10%).</p></div></div>
                      <div className="guide-step"><span>04</span><div><strong>Intersection Recovery</strong><p>Execute two-stage traffic recovery: initiate clearance phase (yellow), verify clearance, then restore normal cycles.</p></div></div>
                      <div className="guide-step"><span>05</span><div><strong>Analyze Fleet Impact</strong><p>View severity distribution charts, utilization percentage, response times, and full event logs.</p></div></div>
                    </div>
                  </article>
                  <article className="panel support-card">
                    <div className="panel-header"><div><h3>Common Operator FAQs</h3><p>Troubleshooting & guidelines.</p></div><span className="settings-icon"><AlertTriangle size={18}/></span></div>
                    <div className="faq-list">
                      <details><summary>Does this control real traffic signals?</summary><p>No. PulseRoute is an educational prototype and research simulation. It does not interface with live traffic controllers or real emergency dispatch.</p></details>
                      <details><summary>How is the priority score calculated?</summary><p>Using a transparent 100-point deterministic formula factoring clinical severity, arrival ETA, route distance, waiting time, and signal readiness.</p></details>
                      <details><summary>What is two-stage traffic recovery?</summary><p>First, an intersection is transitioned to a yellow clearance phase. Once the operator confirms the vehicle has cleared, the signal returns to its normal adaptive timing.</p></details>
                    </div>
                    <button className="secondary-btn support-action" onClick={() => setSupportTab('Report a problem')}><LifeBuoy size={15}/> Report an issue</button>
                  </article>
                </div>
              )}

              {supportTab === 'System status' && (
                <div className="support-grid">
                  <article className="panel support-card">
                    <div className="panel-header"><div><h3>Live Service Health</h3><p>Refreshes every 15 seconds.</p></div><button type="button" className="secondary-btn" onClick={async () => {
                      setHealth(prev => ({ ...prev, loading: true }));
                      try {
                        const r = await fetch(`${API_BASE}/api/health`, { cache: 'no-store' });
                        const d = await r.json();
                        setHealth({ loading: false, api: d.status === 'ok' ? 'online' : 'degraded', database: d.database || 'unknown', checkedAt: new Date(), error: '' });
                      } catch (err) {
                        setHealth({ loading: false, api: 'offline', database: 'unknown', checkedAt: new Date(), error: err.message });
                      }
                    }}><RefreshCw size={14} className={health.loading ? 'spin-icon' : ''}/> Refresh</button></div>
                    <div className="health-list">
                      <HealthRow icon={Server} label="PulseRoute REST API" value={health.loading ? 'Checking…' : health.api === 'online' ? 'Online (Port 5000)' : 'Offline'} state={health.api === 'online' ? 'good' : 'bad'}/>
                      <HealthRow icon={Database} label="MongoDB Local Database" value={health.loading ? 'Checking…' : health.database === 'connected' ? 'Connected' : 'Disconnected'} state={health.database === 'connected' ? 'good' : 'bad'}/>
                      <HealthRow icon={ShieldCheck} label="Operator Session" value={authenticated ? 'Authenticated' : 'Unauthenticated'} state={authenticated ? 'good' : 'bad'}/>
                    </div>
                    <p className="health-caption">{health.checkedAt ? `Last checked ${health.checkedAt.toLocaleTimeString()}` : 'Checking services'}</p>
                  </article>
                  <article className="panel support-card">
                    <div className="panel-header"><div><h3>Architecture Scope</h3><p>Scope boundaries</p></div></div>
                    <div className="status-explainer">
                      <p><strong>PulseRoute API</strong> handles REST endpoints, authentication tokens, and deterministic calculations.</p>
                      <p><strong>MongoDB</strong> stores fleet data, signals, user preferences, and support tickets.</p>
                      <p><strong>Simulation scope:</strong> Not interfaced with live municipal SCATS, SCOOT, or GPS transponders.</p>
                    </div>
                  </article>
                </div>
              )}

              {supportTab === 'QA & Verification' && (
                <div className="qa-runner-container">
                  <div className="qa-hero-panel">
                    <div className="qa-hero-top">
                      <div className="qa-hero-copy">
                        <h3><ShieldCheck size={20} color="#5be0ff"/> Automated QA & Verification Suite</h3>
                        <p>Runs deterministic scoring verification, workflow integrity checks, input sanitization tests, security audits, and live REST API contract validations directly in this environment.</p>
                      </div>
                      <div className="qa-hero-actions">
                        <button type="button" className="qa-run-btn" onClick={runQaVerification} disabled={qaRunning}>
                          {qaRunning ? <RefreshCw size={15} className="spin-icon"/> : <Play size={15}/>}
                          {qaRunning ? 'Running Test Suite…' : (qaResults ? 'Re-run Verification' : 'Run Automated QA Suite')}
                        </button>
                      </div>
                    </div>

                    <div className="qa-metrics-grid">
                      <div className="qa-metric-card">
                        <span className="qa-metric-label">Total Tests</span>
                        <strong className="qa-metric-value">{qaResults ? qaResults.total : 20}</strong>
                      </div>
                      <div className="qa-metric-card">
                        <span className="qa-metric-label">Passed</span>
                        <strong className="qa-metric-value pass">{qaResults ? qaResults.passed : '—'}</strong>
                      </div>
                      <div className="qa-metric-card">
                        <span className="qa-metric-label">Failed</span>
                        <strong className="qa-metric-value fail">{qaResults ? qaResults.failed : '—'}</strong>
                      </div>
                      <div className="qa-metric-card">
                        <span className="qa-metric-label">Execution Time</span>
                        <strong className="qa-metric-value info">{qaResults ? `${qaResults.durationMs}ms` : '—'}</strong>
                      </div>
                      <div className="qa-metric-card">
                        <span className="qa-metric-label">Overall Status</span>
                        <strong className={`qa-metric-value ${qaResults ? (qaResults.failed === 0 ? 'pass' : 'fail') : ''}`}>
                          {qaResults ? (qaResults.failed === 0 ? 'PASS (100%)' : 'DEGRADED') : 'Ready'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {qaResults && (
                    <div className="qa-filter-bar">
                      <div className="qa-filter-tabs">
                        {['All', 'Passed', 'Failed'].map(f => (
                          <button
                            key={f}
                            type="button"
                            className={`qa-filter-tab ${qaFilter === f ? 'active' : ''}`}
                            onClick={() => setQaFilter(f)}
                          >
                            {f} ({f === 'All' ? qaResults.total : f === 'Passed' ? qaResults.passed : qaResults.failed})
                          </button>
                        ))}
                      </div>
                      <span className="qa-timestamp">Executed: {new Date(qaResults.timestamp).toLocaleTimeString()}</span>
                    </div>
                  )}

                  <div className="qa-results-list">
                    {(qaResults?.results || []).filter(r => {
                      if (qaFilter === 'Passed') return r.passed;
                      if (qaFilter === 'Failed') return !r.passed;
                      return true;
                    }).map(test => (
                      <div key={test.id} className={`qa-test-card ${test.passed ? 'pass' : 'fail'}`}>
                        <div className="qa-test-header">
                          <div className="qa-test-title-group">
                            <span className={`qa-status-badge ${test.passed ? 'pass' : 'fail'}`}>
                              {test.passed ? 'PASS' : 'FAIL'}
                            </span>
                            <span className="qa-test-name">{test.name}</span>
                            <span className="qa-test-category">{test.category}</span>
                          </div>
                          <span className="qa-test-duration">{test.durationMs}ms</span>
                        </div>
                        <p className="qa-test-desc">{test.description}</p>
                        <div className={`qa-test-details ${test.passed ? '' : 'error'}`}>
                          {test.passed ? `✓ ${test.details}` : `✗ ${test.error}`}
                        </div>
                      </div>
                    ))}
                    {!qaResults && (
                      <div className="panel empty-state">
                        <ShieldCheck size={32} color="#5be0ff"/>
                        <h3>Test Suite Standing By</h3>
                        <p>Click "Run Automated QA Suite" to execute all 20 tests across the priority engine, workflow state transitions, security sanitization, and live API endpoints.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {supportTab === 'Report a problem' && (
                <div className="support-grid">
                  <form className="panel support-card support-form" onSubmit={submitSupportTicket}>
                    <div className="panel-header"><div><h3>Report an Issue</h3><p>Records a support ticket in the MongoDB project database.</p></div><span className="settings-icon"><FileText size={18}/></span></div>
                    <label htmlFor="support-category">Category</label>
                    <select id="support-category" value={supportCategory} onChange={e => setSupportCategory(e.target.value)}>
                      <option>Bug / unexpected behavior</option><option>Ambulance dispatch</option><option>Signal recovery</option><option>Priority score engine</option><option>Other</option>
                    </select>
                    <label htmlFor="support-severity">Severity</label>
                    <select id="support-severity" value={supportSeverity} onChange={e => setSupportSeverity(e.target.value)}>
                      <option>Low</option><option>Normal</option><option>High</option><option>Critical</option>
                    </select>
                    <label htmlFor="support-subject">Subject</label>
                    <input id="support-subject" value={supportSubject} onChange={e => setSupportSubject(e.target.value)} maxLength={120} minLength={4} placeholder="Summary of issue..." required/>
                    <label htmlFor="support-description">Description</label>
                    <textarea id="support-description" value={supportDescription} onChange={e => setSupportDescription(e.target.value)} minLength={10} maxLength={3000} rows={5} placeholder="Steps to reproduce..." required/>
                    {supportMessage && (
                      <div className={`support-feedback ${supportTicketId ? 'success' : 'error'}`}>
                        {supportMessage} {supportTicketId && <strong>Ticket #{supportTicketId}</strong>}
                      </div>
                    )}
                    <div className="support-form-footer">
                      <span>Saved to MongoDB upon submission.</span>
                      <button className="primary-btn" type="submit" disabled={supportBusy}>
                        {supportBusy ? <RefreshCw size={15} className="spin-icon"/> : <Send size={15}/>} {supportBusy ? 'Submitting…' : 'Submit Ticket'}
                      </button>
                    </div>
                  </form>
                  <article className="panel support-card">
                    <div className="panel-header"><div><h3>Submission Checklist</h3><p>Useful details</p></div><span className="settings-icon"><Info size={18}/></span></div>
                    <div className="checklist">
                      <div><CircleCheck size={17}/><span>State which view or action triggered the issue.</span></div>
                      <div><CircleCheck size={17}/><span>Include the Ambulance ID or Signal ID if relevant.</span></div>
                      <div><CircleCheck size={17}/><span>Tickets are saved to MongoDB collection `supporttickets`.</span></div>
                    </div>
                  </article>
                </div>
              )}

              {supportTab === 'About' && (
                <div className="support-grid">
                  <article className="panel support-card about-hero">
                    <div className="about-brand">
                      <span className="brand-mark"><Siren size={23}/></span>
                      <div><h2>PulseRoute</h2><span>Emergency Traffic Intelligence · Phase 2 Prototype</span></div>
                    </div>
                    <p>AI-Based Multi-Ambulance Priority and Traffic Recovery System — advanced command center for exploring multi-vehicle prioritization, conflict handling, and staged post-emergency signal recovery.</p>
                    <div className="about-tags">
                      <span>React 18 + Vite</span><span>Node.js + Express</span><span>MongoDB</span><span>Deterministic Priority Engine</span>
                    </div>
                  </article>
                  <article className="panel support-card">
                    <div className="panel-header"><div><h3>System Scope & Integrity</h3><p>Transparency statement</p></div><span className="settings-icon"><Info size={18}/></span></div>
                    <div className="status-explainer">
                      <p><strong>Features Included:</strong> Ambulance fleet management, 100-point explainable priority calculations, intersection signal controls, two-stage recovery, and analytics.</p>
                      <p><strong>Simulation Note:</strong> Uses deterministic heuristics and browser-simulated telemetry. Not for real-world emergency dispatch or traffic control.</p>
                    </div>
                  </article>
                </div>
              )}
            </section>
          )}

          <footer className="app-footer">
            <span>PulseRoute <span className="footer-sep">·</span> Advanced Emergency Command Center</span>
            <span><span className="pulse-dot"/> Simulation Mode <span className="footer-sep">·</span> Node.js + MongoDB Connected</span>
          </footer>
        </div>
      </main>

      {/* Register Emergency Modal */}
      {showAdd && (
        <div className="modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="eyebrow"><span className="pulse-dot" /> DISPATCH MANAGEMENT</div>
                <h2>Register Emergency Call</h2>
                <p>Add a simulated emergency ambulance request to the priority queue.</p>
              </div>
              <button className="icon-btn" onClick={() => setShowAdd(false)}><X size={18}/></button>
            </div>
            <form onSubmit={addAmbulance}>
              <label>Emergency Severity</label>
              <div className="severity-options">
                {['Critical', 'High', 'Medium', 'Low'].map(s => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setNewSeverity(s)}
                    className={`severity-option ${s.toLowerCase()} ${newSeverity === s ? 'selected' : ''}`}
                  >
                    <span className={`severity-indicator ${s.toLowerCase()}`}/>
                    {s}
                    {newSeverity === s && <Check size={14}/>}
                  </button>
                ))}
              </div>
              <label htmlFor="patient">Patient Incident / Condition</label>
              <input id="patient" className="modal-input" value={newPatient} onChange={e => setNewPatient(e.target.value)} required />
              <label htmlFor="location">Incident Pickup Location</label>
              <input id="location" className="modal-input" value={newLocation} onChange={e => setNewLocation(e.target.value)} required />
              <label htmlFor="destination">Destination Hospital</label>
              <input id="destination" className="modal-input" value={newDestination} onChange={e => setNewDestination(e.target.value)} required />
              <div className="modal-hint">
                <Zap size={14}/> Priority score is deterministically calculated factoring severity, ETA, distance, and signal readiness.
              </div>
              <div className="modal-actions">
                <button type="button" className="secondary-btn" onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="primary-btn" type="submit"><Plus size={16}/> Add to Dispatch</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Consequential Action Confirmation Modal */}
      {confirmModal && (
        <div className="modal-backdrop" onClick={() => setConfirmModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="eyebrow"><span className="pulse-dot" /> CONFIRMATION REQUIRED</div>
                <h2>{confirmModal.title}</h2>
              </div>
              <button className="icon-btn" onClick={() => setConfirmModal(null)}><X size={18} /></button>
            </div>
            <div className="confirm-modal-body">
              <p>{confirmModal.message}</p>
              {confirmModal.warning && (
                <div className="confirm-modal-warning">
                  <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <span>{confirmModal.warning}</span>
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setConfirmModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={confirmModal.danger ? 'danger-btn' : 'primary-btn'}
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
              >
                {confirmModal.confirmText || 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Factor Breakdown Inspector Modal */}
      {factorInspectorUnit && (
        <div className="modal-backdrop" onClick={() => setFactorInspectorUnit(null)}>
          <div className="modal" style={{ width: 'min(100%, 540px)' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="eyebrow"><span className="pulse-dot" /> EXPLAINABLE HEURISTIC</div>
                <h2>{factorInspectorUnit.id} Priority Breakdown</h2>
                <p>{factorInspectorUnit.patient} · Severity: {factorInspectorUnit.severity}</p>
              </div>
              <button className="icon-btn" onClick={() => setFactorInspectorUnit(null)}><X size={18} /></button>
            </div>

            <div style={{ background: '#091524', border: '1px solid #1a2c42', borderRadius: 8, padding: '14px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#97abc2' }}>Total Objective Priority Score</span>
                <span style={{ fontSize: '20px', fontWeight: 'bold', fontFamily: 'Space Grotesk', color: factorInspectorUnit.score >= 80 ? '#ff5b6e' : '#48d6b0' }}>
                  {factorInspectorUnit.score} / 100
                </span>
              </div>
            </div>

            <table className="score-factor-table">
              <thead>
                <tr>
                  <th>FACTOR</th>
                  <th>EVALUATION DETAIL</th>
                  <th>POINTS</th>
                </tr>
              </thead>
              <tbody>
                {factorInspectorUnit.scoreBreakdown && Object.entries(factorInspectorUnit.scoreBreakdown).map(([key, item]) => (
                  <tr key={key}>
                    <td><strong>{item.label}</strong></td>
                    <td><span>{item.desc}</span></td>
                    <td>
                      <span className={`factor-pts-badge ${item.points >= 0 ? 'pos' : 'neg'}`}>
                        {item.points >= 0 ? `+${item.points}` : item.points} {item.max > 0 ? `/ ${item.max}` : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="modal-actions" style={{ marginTop: '18px' }}>
              <button type="button" className="secondary-btn" onClick={() => setFactorInspectorUnit(null)}>
                Close
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  grantPriority(factorInspectorUnit.id);
                  setFactorInspectorUnit(null);
                }}
              >
                Grant Priority Corridor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Notification Center Popover */}
      <NotificationCenterPopover
        notifications={notifications}
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        onMarkRead={markNotificationRead}
        onMarkAllRead={markAllNotificationsRead}
        onClearAll={clearAllNotifications}
        onSelectEmergency={(id) => {
          const amb = ambs.find(a => a.id === id);
          if (amb) setSelectedEmergency(amb);
          setShowNotifications(false);
        }}
      />

      {/* Emergency Details Panel with 7-Stage Event Timeline */}
      {selectedEmergency && (
        <EmergencyDetailsDrawer
          ambulance={selectedEmergency}
          onClose={() => setSelectedEmergency(null)}
          signals={signals}
          allAmbulances={ambs}
          onPriority={grantPriority}
          onStatusChange={updateAmbulanceStatus}
          onRecoverTraffic={recoverTraffic}
          onCompleteTrip={promptCompleteEmergency}
          recoveryStage={recoveryStage}
        />
      )}

      {/* Toast notification */}
      {toast && <div className="toast"><Check size={16}/>{toast}</div>}
    </div>
  );
}

// Subcomponents
function HospitalIcon(props) { return <HeartPulse {...props}/> }
function DatabaseIcon(props) { return <Database {...props}/> }

function HealthRow({ icon: Icon, label, value, state }) {
  return (
    <div className="health-row">
      <span className="health-service-icon"><Icon size={17}/></span>
      <div className="health-service-copy">
        <strong>{label}</strong>
        <span>{state === 'good' ? 'Healthy' : state === 'bad' ? 'Needs attention' : 'Checking'}</span>
      </div>
      <span className={`health-status ${state}`}><i/>{value}</span>
    </div>
  );
}

function Metric({ icon: Icon, label, value, change, tone, trend }) {
  return (
    <div className="metric-card">
      <div className="metric-top">
        <span className={`metric-icon ${tone}`}><Icon size={18}/></span>
        {trend && (
          <span className={`metric-trend ${trend}`}>
            {trend === 'down' ? <ArrowDownRight size={13}/> : <ArrowUpRight size={13}/>}{' '}
            {trend === 'down' ? 'Optimal' : 'Trending'}
          </span>
        )}
      </div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-change"><span className="change-dot"/>{change}</div>
    </div>
  );
}

function Factor({ label, value, color, desc }) {
  return (
    <div>
      <div className="factor-top">
        <strong>{label}</strong>
        <b>Max {value} pts</b>
      </div>
      <div className="factor-track">
        <span className={color} style={{ width: `${(value / 40) * 100}%` }}/>
      </div>
      <span className="factor-desc">{desc}</span>
    </div>
  );
}

function TrafficMap({ ambs, signals, running, large = false, onSelect }) {
  return (
    <div className={`traffic-map ${large ? 'traffic-map-large' : ''}`}>
      <div className="map-top-label">
        <MapPinned size={13}/> CENTRAL CITY GRID <span>SIMULATED CORRIDORS</span>
      </div>
      <div className="map-area">
        <svg className="road-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="City Road Grid">
          <defs>
            <pattern id="blocks" width="16" height="16" patternUnits="userSpaceOnUse">
              <rect x="1" y="1" width="13" height="13" rx="1.2" fill="#111f30" stroke="#1a2b3d" strokeWidth=".35"/>
              <path d="M3 4h8M3 6h6" stroke="#1a2b3d" strokeWidth=".45"/>
            </pattern>
          </defs>
          <rect width="100" height="100" fill="url(#blocks)"/>
          <g stroke="#26374a" strokeWidth="7" fill="none">
            <path d="M-5 20 L105 20"/><path d="M-5 45 L105 45"/><path d="M-5 70 L105 70"/>
            <path d="M20 -5 L20 105"/><path d="M47 -5 L47 105"/><path d="M74 -5 L74 105"/><path d="M91 -5 L91 105"/>
          </g>
          <g stroke="#4b5c6e" strokeWidth=".35" strokeDasharray="1.5 1.5" fill="none">
            <path d="M-5 20 L105 20"/><path d="M-5 45 L105 45"/><path d="M-5 70 L105 70"/>
            <path d="M20 -5 L20 105"/><path d="M47 -5 L47 105"/><path d="M74 -5 L74 105"/><path d="M91 -5 L91 105"/>
          </g>
          <path d="M5 88 Q22 79 32 63 T50 45 T68 30 T96 8" stroke="#102d42" strokeWidth="9" fill="none"/>
          <path d="M5 88 Q22 79 32 63 T50 45 T68 30 T96 8" stroke="#29465d" strokeWidth=".5" strokeDasharray="2 1" fill="none"/>
          <path d={`M${ambs[0]?.x||20} ${ambs[0]?.y||58} Q27 54 34 45 T47 45`} stroke="#ff5b6e" strokeWidth=".7" strokeDasharray="1.6 1.1" fill="none" opacity=".9"/>
          <path d={`M${ambs[1]?.x||48} ${ambs[1]?.y||29} Q54 31 61 40 T74 45`} stroke="#f6b94a" strokeWidth=".7" strokeDasharray="1.6 1.1" fill="none" opacity=".85"/>
          <path d={`M${ambs[2]?.x||73} ${ambs[2]?.y||71} Q61 72 47 75 T34 70`} stroke="#48d6b0" strokeWidth=".7" strokeDasharray="1.6 1.1" fill="none" opacity=".8"/>
        </svg>

        {signals.map(s => (
          <div key={s.id} className={`map-signal ${s.light}`} style={{ left: `${s.x}%`, top: `${s.y}%` }} title={`${s.id}: ${s.state}`}>
            <span className="signal-head"><i/><i/><i/></span>
          </div>
        ))}

        {ambs.map(a => (
          <div
            key={a.id}
            className="map-ambulance"
            style={{ left: `${a.x}%`, top: `${a.y}%`, cursor: onSelect ? 'pointer' : 'default' }}
            title={`${a.id} · ${a.severity} · ${a.status} (Click to inspect timeline)`}
            onClick={() => onSelect?.(a)}
          >
            <span className="vehicle-halo" style={{ borderColor: a.color }}/>
            <span className="vehicle-marker" style={{ background: a.color }}>
              <Ambulance size={14}/>
            </span>
            <span className="vehicle-label">{a.id}</span>
          </div>
        ))}

        <div className="map-place place-hospital"><HeartPulse size={12}/> CITY HOSPITAL</div>
        <div className="map-place place-center">TRAUMA CENTRE</div>
        <div className="map-compass"><Navigation size={14}/><span>N</span></div>
        {!running && <div className="map-paused"><Pause size={16}/> SIMULATION PAUSED</div>}
      </div>
      <div className="map-bottom-label">
        <span><span className="pulse-dot"/> GPS SIMULATION ACTIVE</span>
        <span>Simulated Map · Demonstrative Telemetry</span>
      </div>
    </div>
  );
}

function AmbulanceTable({ ambs, onPriority, onStatusChange, onInspect, onSelect }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>UNIT / ID</th>
            <th>SEVERITY</th>
            <th>DESTINATION</th>
            <th>ETA</th>
            <th>STATUS</th>
            <th>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {ambs.map(a => (
            <tr key={a.id}>
              <td style={{ cursor: onSelect ? 'pointer' : 'default' }} onClick={() => onSelect?.(a)} title="Open emergency details & timeline">
                <div className="unit-cell">
                  <span className="unit-icon" style={{ borderColor: a.color, color: a.color }}><Ambulance size={16}/></span>
                  <div>
                    <strong>{a.id}</strong>
                    <span>{a.name}</span>
                  </div>
                </div>
              </td>
              <td><span className={`severity-tag ${a.severity.toLowerCase()}`}><i/> {a.severity}</span></td>
              <td style={{ cursor: onSelect ? 'pointer' : 'default' }} onClick={() => onSelect?.(a)} title="Open emergency details">
                <div className="route-cell">
                  <strong>{a.destination || 'City Hospital'}</strong>
                  <span>{a.patient}</span>
                </div>
              </td>
              <td><strong className="eta-value">{a.eta}</strong><span className="table-sub">{a.distance}</span></td>
              <td><span className={`status-tag ${a.status.toLowerCase().replaceAll(' ', '-')}`}><i/>{a.status}</span></td>
              <td>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className={`action-btn ${a.status === 'Priority granted' ? 'granted' : ''}`}
                    onClick={() => onPriority(a.id)}
                    disabled={a.status === 'Completed' || a.status === 'Available'}
                    title="Grant signal priority corridor"
                  >
                    {a.status === 'Priority granted' ? <><Check size={12}/> Granted</> : <>Prioritize <ArrowUpRight size={12}/></>}
                  </button>
                  {onSelect && (
                    <button className="action-btn" onClick={() => onSelect(a)} title="Open 7-stage event timeline & emergency details">
                      <FileText size={12}/> Details
                    </button>
                  )}
                  {onInspect && (
                    <button className="action-btn" onClick={() => onInspect(a)} title="Inspect priority score factors">
                      <Eye size={12}/>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {ambs.length === 0 && <div className="empty-state">No units to display.</div>}
    </div>
  );
}

function SignalRow({ signal }) {
  return (
    <div className="signal-row">
      <div className={`signal-icon ${signal.light}`}>
        <TrafficCone size={17}/>
      </div>
      <div className="signal-info">
        <strong>{signal.name}</strong>
        <span>{signal.id} · {signal.mode}</span>
      </div>
      <div className={`traffic-light ${signal.light}`}>
        <i style={{ background: signal.light === 'red' ? '#ff5b6e' : '#334152' }}/>
        <i style={{ background: signal.light === 'yellow' ? '#f6b94a' : '#334152' }}/>
        <i style={{ background: signal.light === 'green' ? '#48d6b0' : '#334152' }}/>
      </div>
    </div>
  );
}

// Notification Center Popover Component
function NotificationCenterPopover({
  notifications,
  isOpen,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onClearAll,
  onSelectEmergency
}) {
  if (!isOpen) return null;
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      <div className="notif-backdrop" onClick={onClose} />
      <div className="notif-popover" role="dialog" aria-label="Emergency Notification Center">
        <div className="notif-popover-header">
          <div className="notif-header-title">
            <Bell size={16} style={{ color: '#42d9ff' }} />
            <span>Emergency Notifications</span>
            {unreadCount > 0 && <span className="notif-count-pill">{unreadCount} unread</span>}
          </div>
          <div className="notif-header-actions">
            {unreadCount > 0 && (
              <button type="button" onClick={onMarkAllRead} title="Mark all notifications as read">
                <Check size={12} /> Read all
              </button>
            )}
            {notifications.length > 0 && (
              <button type="button" onClick={onClearAll} title="Clear all notifications">
                <X size={12} /> Clear
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Close" style={{ padding: '5px' }}>
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="notif-popover-body">
          {notifications.length === 0 ? (
            <div className="notif-empty">
              <ShieldCheck size={28} style={{ opacity: 0.5 }} />
              <strong>No notifications logged</strong>
              <span>Emergency creation, priority grants, and signal recovery updates will appear here in real time.</span>
            </div>
          ) : (
            notifications.map(n => {
              const catClass = (n.category || 'emergency').toLowerCase().replace(/\s+/g, '-');
              const timeFormatted = new Date(n.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour12: false });
              return (
                <div
                  key={n.id || n._id}
                  className={`notif-item ${n.read ? 'read' : 'unread'}`}
                  onClick={() => {
                    if (!n.read) onMarkRead(n.id);
                    if (n.ambulanceId) onSelectEmergency(n.ambulanceId);
                  }}
                  title={n.read ? 'Marked as read' : 'Click to mark as read & inspect details'}
                >
                  <div className="notif-item-top">
                    <span className={`notif-cat-tag ${catClass}`}>
                      {n.category || 'Emergency'}
                    </span>
                    {!n.read && <span className="notif-unread-dot" title="Unread alert" />}
                    <span className="notif-time-str">{timeFormatted}</span>
                  </div>
                  <div className="notif-title-row">{n.title}</div>
                  <div className="notif-message-row">{n.message}</div>
                  {n.ambulanceId && (
                    <div style={{ marginTop: '4px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <span style={{ fontSize: '9px', color: '#42d9ff', background: '#0e2439', padding: '1px 6px', borderRadius: 3, fontWeight: 600 }}>
                        Unit {n.ambulanceId}
                      </span>
                      {n.signalId && (
                        <span style={{ fontSize: '9px', color: '#f6b94a', background: '#262211', padding: '1px 6px', borderRadius: 3, fontWeight: 600 }}>
                          Signal {n.signalId}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

// Emergency Details Drawer Component (Full 7-Stage Structured Event Timeline)
function EmergencyDetailsDrawer({
  ambulance,
  onClose,
  signals,
  allAmbulances,
  onPriority,
  onStatusChange,
  onRecoverTraffic,
  onCompleteTrip,
  recoveryStage
}) {
  if (!ambulance) return null;

  const targetSignal = findNearestSignal(ambulance, signals);
  const conflicts = getRouteConflicts(allAmbulances, signals);
  const unitConflict = conflicts.find(c => c.ambulanceA.id === ambulance.id || c.ambulanceB.id === ambulance.id);

  // 7 structured stages from ambulance.timeline or generated
  const timeline = (ambulance.timeline && ambulance.timeline.length === 7)
    ? ambulance.timeline
    : [
        { step: 1, title: 'Emergency registered', status: 'completed', timestamp: '14:28:10', actor: 'Dispatch Intake (Simulated)', note: `${ambulance.patient} (${ambulance.severity}) logged`, isSimulated: true },
        { step: 2, title: 'Priority calculated', status: 'completed', timestamp: '14:28:22', actor: 'PulseRoute Deterministic Engine', note: `Score: ${ambulance.priorityScore || 50}/100 with corridor check`, isSimulated: true },
        { step: 3, title: 'Ambulance assigned', status: ['Assigned', 'En Route', 'Priority granted', 'At Scene', 'Completed'].includes(ambulance.status) ? 'completed' : 'pending', timestamp: '14:28:45', actor: 'Fleet Operations (Simulated)', note: `Unit ${ambulance.id} allocated`, isSimulated: true },
        { step: 4, title: 'Ambulance en route', status: ['En Route', 'Priority granted', 'At Scene', 'Completed'].includes(ambulance.status) ? 'completed' : (ambulance.status === 'Assigned' ? 'current' : 'pending'), timestamp: '14:29:20', actor: 'Operator / Simulated Telemetry', note: `Speed ${ambulance.speed} · ETA ${ambulance.eta}`, isSimulated: true },
        { step: 5, title: 'Arrival at scene', status: ['At Scene', 'Completed'].includes(ambulance.status) ? 'completed' : (['En Route', 'Priority granted'].includes(ambulance.status) ? 'current' : 'pending'), timestamp: ambulance.status === 'At Scene' || ambulance.status === 'Completed' ? '14:34:10' : null, actor: 'Ambulance Crew (Manual Confirmation)', note: ambulance.status === 'At Scene' || ambulance.status === 'Completed' ? 'Patient stabilized on site' : 'Awaiting arrival at scene', isSimulated: true },
        { step: 6, title: 'Hospital destination reached', status: ambulance.status === 'Completed' ? 'completed' : 'pending', timestamp: ambulance.status === 'Completed' ? '14:40:00' : null, actor: 'Hospital Receiving Intake (Manual Confirmation)', note: ambulance.status === 'Completed' ? `Patient received at ${ambulance.destination}` : `En route to ${ambulance.destination}`, isSimulated: true },
        { step: 7, title: 'Signal recovery completed', status: ambulance.status === 'Completed' ? 'completed' : (ambulance.status === 'Priority granted' ? 'current' : 'pending'), timestamp: ambulance.status === 'Completed' ? '14:41:15' : null, actor: 'Adaptive Traffic Controller', note: ambulance.status === 'Completed' ? 'Corridor preemption released, normal adaptive cycles restored' : 'Awaiting emergency vehicle clearance', isSimulated: true }
      ];

  return (
    <>
      <div className="emergency-drawer-backdrop" onClick={onClose} />
      <aside className="emergency-drawer" role="dialog" aria-label={`Emergency Details · ${ambulance.id}`}>
        <div className="drawer-header">
          <div className="drawer-header-left">
            <span className="drawer-unit-badge" style={{ borderColor: ambulance.color, color: ambulance.color }}>
              <Ambulance size={20} />
            </span>
            <div className="drawer-title-box">
              <strong>{ambulance.id} · {ambulance.name}</strong>
              <span>Emergency Command Detail · Simulated Corridor</span>
            </div>
          </div>
          <button className="drawer-close-btn" onClick={onClose} aria-label="Close details panel">
            <X size={16} />
          </button>
        </div>

        <div className="drawer-body">
          {/* Hero Card */}
          <div className="drawer-hero-card">
            <div className="drawer-hero-top">
              <span className={`severity-tag ${ambulance.severity.toLowerCase()}`}>
                <i /> {ambulance.severity} Severity
              </span>
              <span className={`status-tag ${ambulance.status.toLowerCase().replaceAll(' ', '-')}`}>
                <i /> {ambulance.status}
              </span>
            </div>
            <div className="drawer-patient-title">{ambulance.patient}</div>
            <div className="drawer-route-banner">
              <Route size={14} style={{ color: '#42d9ff' }} />
              <span>{ambulance.route} &rarr; <strong>{ambulance.destination}</strong></span>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="drawer-metrics-grid">
            <div className="drawer-metric-box">
              <strong style={{ color: '#5be0ff' }}>{ambulance.eta}</strong>
              <span>Simulated ETA</span>
            </div>
            <div className="drawer-metric-box">
              <strong>{ambulance.distance}</strong>
              <span>Distance</span>
            </div>
            <div className="drawer-metric-box">
              <strong>{ambulance.speed}</strong>
              <span>Telemetry</span>
            </div>
            <div className="drawer-metric-box">
              <strong style={{ color: '#48d6b0' }}>{ambulance.waitingTime}m</strong>
              <span>Queue Wait</span>
            </div>
          </div>

          {/* Priority Score & Explainability */}
          <div className="drawer-score-panel">
            <div className="drawer-score-header">
              <div>
                <strong>Deterministic Priority Score</strong>
                <p style={{ margin: 0, fontSize: '9px', color: '#88a3be' }}>100-Point Rule Engine (Auditable)</p>
              </div>
              <span className="drawer-score-badge">{ambulance.score || ambulance.priorityScore || 50}/100</span>
            </div>
            <div style={{ fontSize: '10px', color: '#b9cee4', lineHeight: 1.5 }}>
              Target Intersection: <strong>{targetSignal ? targetSignal.name : 'Central Corridor'}</strong> ({targetSignal?.id || 'SIG-01'}).
              State: <span style={{ color: targetSignal?.light === 'green' ? '#48d6b0' : targetSignal?.light === 'yellow' ? '#f6b94a' : '#ff5b6e', fontWeight: 600 }}>
                {targetSignal?.state || 'Normal cycle'}
              </span>.
            </div>
          </div>

          {/* Route Conflict Warning Banner (if applicable) */}
          {unitConflict && (
            <div className="drawer-conflict-alert">
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Corridor Conflict: Shared Intersection ({unitConflict.signal?.name || 'Intersection'})</strong>
                <span>
                  Competing with {unitConflict.ambulanceA.id === ambulance.id ? unitConflict.ambulanceB.id : unitConflict.ambulanceA.id}.
                  Priority engine recommendation: <strong>Unit {unitConflict.winner.id}</strong> ({unitConflict.reason}).
                </span>
              </div>
            </div>
          )}

          {/* 7-Stage Structured Event Timeline */}
          <div className="timeline-section">
            <div className="timeline-section-title">
              <span>EMERGENCY EVENT TIMELINE (7-STAGE)</span>
              <span style={{ fontSize: '9px', color: '#6e89a5', fontWeight: 500 }}>Audit Log & Traceability</span>
            </div>

            <div className="timeline-stepper">
              {timeline.map((step) => {
                const isCompleted = step.status === 'completed';
                const isCurrent = step.status === 'current';
                return (
                  <div key={step.step} className={`timeline-step-row ${step.status}`}>
                    <div className="timeline-marker">
                      {isCompleted ? <Check size={11} strokeWidth={3} /> : isCurrent ? <Radio size={10} /> : step.step}
                    </div>
                    <div className="timeline-step-header">
                      <span className="timeline-step-title">{step.title}</span>
                      <span className="timeline-step-time">
                        {step.timestamp ? new Date(step.timestamp).toLocaleTimeString('en-IN', { hour12: false }) : 'Pending'}
                      </span>
                    </div>
                    <div className="timeline-step-actor-row">
                      <span className="timeline-actor-pill">{step.actor}</span>
                      <span className="timeline-simulated-tag">{step.isSimulated ? 'Simulated Telemetry' : 'Manual Action'}</span>
                    </div>
                    <div className="timeline-step-note">{step.note}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Permitted Next Actions Toolbar */}
        <div className="drawer-footer-actions">
          <span className="drawer-actions-label">Permitted Next Actions</span>
          <div className="drawer-btn-grid">
            {ambulance.status === 'Assigned' && (
              <button
                type="button"
                className="drawer-action-btn primary"
                onClick={() => onStatusChange(ambulance.id, 'En Route')}
              >
                <Navigation size={13} /> Dispatch En Route
              </button>
            )}

            {ambulance.status === 'En Route' && (
              <>
                <button
                  type="button"
                  className="drawer-action-btn primary"
                  onClick={() => onPriority(ambulance.id)}
                >
                  <Sparkles size={13} /> Grant Priority Corridor
                </button>
                <button
                  type="button"
                  className="drawer-action-btn cyan"
                  onClick={() => onStatusChange(ambulance.id, 'At Scene')}
                >
                  <MapPinned size={13} /> Confirm Arrival At Scene
                </button>
              </>
            )}

            {ambulance.status === 'Priority granted' && (
              <>
                <button
                  type="button"
                  className="drawer-action-btn green"
                  onClick={onRecoverTraffic}
                >
                  <RefreshCw size={13} /> {recoveryStage === 'clearance' ? 'Confirm Clearance & Restore' : 'Initiate Signal Recovery'}
                </button>
                <button
                  type="button"
                  className="drawer-action-btn cyan"
                  onClick={() => onStatusChange(ambulance.id, 'At Scene')}
                >
                  <MapPinned size={13} /> Confirm Arrival At Scene
                </button>
              </>
            )}

            {ambulance.status === 'At Scene' && (
              <>
                <button
                  type="button"
                  className="drawer-action-btn cyan"
                  onClick={() => onStatusChange(ambulance.id, 'En Route')}
                >
                  <Route size={13} /> Transport to Hospital
                </button>
                <button
                  type="button"
                  className="drawer-action-btn green"
                  onClick={() => onCompleteTrip(ambulance.id)}
                >
                  <Check size={13} /> Complete Emergency Trip
                </button>
              </>
            )}

            {ambulance.status === 'Completed' && (
              <button
                type="button"
                className="drawer-action-btn secondary"
                onClick={() => onStatusChange(ambulance.id, 'Available')}
              >
                <RotateCcw size={13} /> Reset to Available
              </button>
            )}

            {ambulance.status === 'Available' && (
              <button
                type="button"
                className="drawer-action-btn primary"
                onClick={() => onStatusChange(ambulance.id, 'Assigned')}
              >
                <Ambulance size={13} /> Assign to Dispatch
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
export default App;

