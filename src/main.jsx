import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, Ambulance, ArrowDownRight, ArrowUpRight, Bell, Check, ChevronDown,
  CircleHelp, Clock3, Command, Gauge, HeartPulse, LayoutDashboard, LogOut,
  MapPinned, Menu, MoreHorizontal, Navigation, Pause, Play, Plus, Radio,
  RefreshCw, Route, Search, Settings2, ShieldCheck, Siren, Signal, SlidersHorizontal,
  Sparkles, TrafficCone, TrendingUp, Users, X, Zap
} from 'lucide-react';
import './styles.css';
import { rankAmbulances, recommendPriority, getRouteConflicts } from './priorityEngine.js';

const initialAmbulances = [
  { id: 'AMB-104', name: 'Unit 104', severity: 'Critical', patient: 'Cardiac emergency', eta: '04 min', distance: '2.1 km', speed: '42 km/h', route: 'North Avenue → City Hospital', status: 'En route', color: '#ff5b6e', x: 20, y: 58, score: 96 },
  { id: 'AMB-208', name: 'Unit 208', severity: 'High', patient: 'Road accident', eta: '07 min', distance: '3.8 km', speed: '36 km/h', route: 'Market Road → Trauma Centre', status: 'Priority granted', color: '#f6b94a', x: 48, y: 29, score: 82 },
  { id: 'AMB-315', name: 'Unit 315', severity: 'Moderate', patient: 'Respiratory distress', eta: '11 min', distance: '6.4 km', speed: '31 km/h', route: 'University Road → General Hospital', status: 'Approaching', color: '#48d6b0', x: 73, y: 71, score: 64 },
];
const initialSignals = [
  { id: 'SIG-01', name: 'North Avenue / 5th St', state: 'Priority green', light: 'green', mode: 'Emergency override', x: 34, y: 45 },
  { id: 'SIG-02', name: 'Market Road / Central', state: 'Normal cycle', light: 'red', mode: 'Adaptive control', x: 61, y: 40 },
  { id: 'SIG-03', name: 'University Rd / Ring Rd', state: 'Normal cycle', light: 'green', mode: 'Adaptive control', x: 75, y: 59 },
  { id: 'SIG-04', name: 'Hospital Link / East Gate', state: 'Recovery phase', light: 'yellow', mode: 'Clearance check', x: 47, y: 75 },
];

function App() {
  const [authenticated, setAuthenticated] = useState(Boolean(localStorage.getItem('pulseroute_token')));
  const [apiStatus, setApiStatus] = useState('Connecting to API');
  const [authBusy, setAuthBusy] = useState(false);
  const [email, setEmail] = useState('operator@pulseroute.demo');
  const [password, setPassword] = useState('demo1234');
  const [page, setPage] = useState('Overview');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [ambs, setAmbs] = useState(initialAmbulances);
  const [signals, setSignals] = useState(initialSignals);
  const [running, setRunning] = useState(true);
  const [recoveryStage, setRecoveryStage] = useState('idle');
  const [alerts, setAlerts] = useState(true);
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [toast, setToast] = useState('');
  const [newSeverity, setNewSeverity] = useState('High');
  const [newLocation, setNewLocation] = useState('Railway Crossing');
  const [timeRange, setTimeRange] = useState('Last 60 min');
  const [eventLog, setEventLog] = useState([{ id: 1, time: '14:32:08', message: 'Priority engine initialized', type: 'system' }]);

  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
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
  const notify = (msg) => { setToast(msg); window.setTimeout(() => setToast(''), 2800); };
  const priority = useMemo(() => rankAmbulances(ambs, signals), [ambs, signals]);
  const recommendation = useMemo(() => recommendPriority(ambs, signals), [ambs, signals]);
  const routeConflicts = useMemo(() => getRouteConflicts(ambs, signals), [ambs, signals]);

  function logEvent(message, type = 'system') {
    setEventLog(prev => [{ id: Date.now() + Math.random(), time: new Date().toLocaleTimeString('en-IN', { hour12: false }), message, type }, ...prev].slice(0, 8));
    if (localStorage.getItem('pulseroute_token')) {
      apiRequest('/api/events', { method: 'POST', body: JSON.stringify({ message, type }) }).catch(error => console.error('Could not save event:', error.message));
    }
  }

  React.useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    async function loadDashboardData() {
      try {
        const [ambulances, signalData, events] = await Promise.all([
          apiRequest('/api/ambulances'), apiRequest('/api/signals'), apiRequest('/api/events')
        ]);
        if (cancelled) return;
        if (ambulances.length) setAmbs(ambulances);
        if (signalData.length) setSignals(signalData);
        if (events.length) setEventLog(events.map((event, index) => ({
          id: event._id || index,
          time: new Date(event.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour12: false }),
          message: event.message, type: event.type || 'system'
        })));
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
  const filtered = priority.filter(a => `${a.id} ${a.name} ${a.patient} ${a.severity}`.toLowerCase().includes(query.toLowerCase()));

  React.useEffect(() => {
    if (!running || !authenticated) return undefined;
    const timer = window.setInterval(() => {
      setAmbs(prev => prev.map(a => {
        if (a.status === 'Completed') return a;
        const nextX = Math.max(8, Math.min(92, (a.x ?? 50) + (Math.random() - 0.5) * 3));
        const nextY = Math.max(8, Math.min(92, (a.y ?? 50) + (Math.random() - 0.5) * 3));
        return { ...a, x: nextX, y: nextY };
      }));
    }, 4000);
    return () => window.clearInterval(timer);
  }, [running, authenticated]);

  function grantPriority(id) {
    const ranked = rankAmbulances(ambs, signals);
    const selected = ranked.find(a => a.id === id);
    const current = ranked.find(a => a.status === 'Priority granted' && a.id !== id);
    if (!selected) return;
    if (current && current.score > selected.score && selected.severity !== 'Critical') {
      notify(`Conflict check: ${current.id} has higher priority (${current.score} vs ${selected.score}).`);
      logEvent(`Priority request for ${id} held: ${current.id} ranks higher`, 'warning');
      return;
    }
    const targetSignalId = selected.targetSignalId || signals[0]?.id;
    setRecoveryStage('idle');
    setAmbs(prev => prev.map(a => ({ ...a, status: a.id === id ? 'Priority granted' : a.status === 'Priority granted' ? 'En route' : a.status })));
    setSignals(prev => prev.map(s => s.id === targetSignalId
      ? { ...s, light: 'green', state: 'Priority green', mode: `Emergency override · ${id}` }
      : s.state === 'Priority green' ? { ...s, light: 'yellow', state: 'Recovery phase', mode: 'Clearance check' } : s));
    apiRequest(`/api/ambulances/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'Priority granted' }) }).catch(error => notify(`Priority changed locally but failed to save: ${error.message}`));
    if (targetSignalId) apiRequest(`/api/signals/${encodeURIComponent(targetSignalId)}`, { method: 'PATCH', body: JSON.stringify({ light: 'green', state: 'Priority green', mode: `Emergency override · ${id}` }) }).catch(error => notify(`Signal update failed to save: ${error.message}`));
    logEvent(`${id} granted priority at ${signals.find(s => s.id === targetSignalId)?.name || 'nearest intersection'} (score ${selected.score})`, 'priority');
    notify(`Priority corridor activated for ${id} · score ${selected.score}`);
  }
  function recoverTraffic() {
    const activeSignal = signals.find(s => s.state === 'Priority green');
    const activeAmbulance = ambs.find(a => a.status === 'Priority granted');

    // Stage 1: move the active emergency phase to yellow and run a clearance check.
    if (activeSignal && recoveryStage !== 'clearance') {
      setSignals(prev => prev.map(s => s.id === activeSignal.id
        ? { ...s, light: 'yellow', state: 'Recovery phase', mode: 'Clearance check' }
        : s));
      setRecoveryStage('clearance');
      apiRequest(`/api/signals/${encodeURIComponent(activeSignal.id)}`, { method: 'PATCH', body: JSON.stringify({ light: 'yellow', state: 'Recovery phase', mode: 'Clearance check' }) }).catch(error => notify(`Clearance started locally but failed to save: ${error.message}`));
      logEvent(`Clearance check started at ${activeSignal.id}${activeAmbulance ? ` for ${activeAmbulance.id}` : ''}`, 'recovery');
      notify('Clearance phase started · confirm the route is clear to resume normal traffic');
      return;
    }

    // Stage 2: explicit operator confirmation releases the override.
    setSignals(prev => prev.map(s => ({ ...s, light: 'green', state: 'Normal cycle', mode: 'Adaptive control' })));
    setAmbs(prev => prev.map(a => a.status === 'Priority granted' ? { ...a, status: 'En route' } : a));
    setRecoveryStage('idle');
    signals.forEach(signal => apiRequest(`/api/signals/${encodeURIComponent(signal.id)}`, { method: 'PATCH', body: JSON.stringify({ light: 'green', state: 'Normal cycle', mode: 'Adaptive control' }) }).catch(error => console.error('Could not persist signal recovery:', error.message)));
    ambs.filter(a => a.status === 'Priority granted').forEach(a => apiRequest(`/api/ambulances/${encodeURIComponent(a.id)}`, { method: 'PATCH', body: JSON.stringify({ status: 'En route' }) }).catch(error => console.error('Could not persist ambulance status:', error.message)));
    logEvent('Clearance confirmed; emergency override released and adaptive cycle resumed', 'recovery');
    notify('Recovery complete · signals returned to the simulated normal cycle');
  }
  async function addAmbulance(e) {
    e.preventDefault();
    const id = `AMB-${Math.floor(400 + Math.random() * 500)}`;
    const ambulance = { id, name: `Unit ${id.slice(4)}`, severity: newSeverity, patient: 'New emergency request', eta: '06 min', distance: '3.2 km', speed: '38 km/h', route: `${newLocation} → City Hospital`, status: 'Awaiting priority', color: newSeverity === 'Critical' ? '#ff5b6e' : newSeverity === 'High' ? '#f6b94a' : '#48d6b0', x: 16 + Math.random()*65, y: 18 + Math.random()*65 };
    try {
      const saved = await apiRequest('/api/ambulances', { method: 'POST', body: JSON.stringify(ambulance) });
      setAmbs(prev => [saved, ...prev]);
      setShowAdd(false); logEvent(`${saved.id} registered at ${newLocation} · ${newSeverity} severity`, 'new'); notify(`${saved.id} saved to MongoDB and added to dispatch`);
    } catch (error) { notify(`Could not save emergency: ${error.message}`); }
  }
  async function signIn(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { notify('Enter your operator email and password'); return; }
    setAuthBusy(true);
    try {
      const result = await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      localStorage.setItem('pulseroute_token', result.token);
      setEmail(result.user.email); setAuthenticated(true); setApiStatus('MongoDB connected');
      notify('Signed in securely · backend connected');
    } catch (error) { notify(error.message || 'Login failed. Check backend credentials.'); }
    finally { setAuthBusy(false); }
  }

  if (!authenticated) return <div className="login-shell"><div className="login-art"><div className="brand"><div className="brand-mark"><Siren size={23}/></div><span>Pulse<span className="brand-accent">Route</span></span></div><div className="login-message"><div className="eyebrow"><span className="pulse-dot"/> EMERGENCY RESPONSE INTELLIGENCE</div><h1>Every second<br/>moves <span>someone</span><br/>closer to help.</h1><p>Coordinate emergency vehicles, prioritize intersections, and recover city traffic — from one command center.</p><div className="login-stats"><div><strong>03</strong><span>Active units</span></div><div><strong>04</strong><span>Connected signals</span></div><div><strong>−38%</strong><span>Simulated delay</span></div></div></div><div className="art-grid"><div className="art-route route-one"/><div className="art-route route-two"/><div className="art-pin"><Ambulance size={22}/></div><div className="art-cross cross-one"><i/><i/><i/></div><div className="art-cross cross-two"><i/><i/><i/></div></div><div className="login-foot"><span><ShieldCheck size={14}/> Controlled demo environment</span><span>© 2026 PulseRoute</span></div></div><div className="login-panel"><form className="login-form" onSubmit={signIn}><div className="mobile-brand brand"><div className="brand-mark"><Siren size={22}/></div><span>Pulse<span className="brand-accent">Route</span></span></div><div className="form-kicker">COMMAND CENTER ACCESS</div><h2>Welcome back</h2><p className="muted">Sign in to access your emergency operations dashboard.</p><label htmlFor="email">Operator email</label><div className="input-wrap"><Users size={17}/><input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@organization.com" required/></div><label htmlFor="password">Password</label><div className="input-wrap"><ShieldCheck size={17}/><input id="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter password" required/></div><div className="form-options"><label className="remember"><input type="checkbox" defaultChecked/> Remember me</label><button type="button" className="text-button" onClick={()=>notify('Demo mode: use the prefilled credentials.')}>Forgot password?</button></div><button className="primary-btn login-btn" type="submit" disabled={authBusy}>{authBusy ? 'Connecting…' : 'Enter command center'} <ArrowUpRight size={17}/></button><div className="demo-hint"><Sparkles size={15}/><span><strong>Operator demo account</strong><br/>operator@pulseroute.demo / demo1234</span></div><div className="login-security"><ShieldCheck size={14}/> Protected demo · No real dispatch connection</div></form></div>{toast && <div className="toast"><Check size={16}/>{toast}</div>}</div>;

  const nav = [{ label: 'Overview', icon: LayoutDashboard }, { label: 'Live Map', icon: MapPinned }, { label: 'Coordination', icon: Route }, { label: 'Traffic Recovery', icon: RefreshCw }];
  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}><div className="brand sidebar-brand"><div className="brand-mark"><Siren size={22}/></div><span>Pulse<span className="brand-accent">Route</span></span><button className="mobile-close icon-btn" onClick={()=>setMobileMenu(false)}><X size={18}/></button></div><div className="workspace"><div className="workspace-icon"><Command size={18}/></div><div><strong>City Operations</strong><span>Emergency response</span></div><ChevronDown size={15}/></div><div className="nav-label">WORKSPACE</div><nav>{nav.map(item=><button key={item.label} onClick={()=>{setPage(item.label);setMobileMenu(false)}} className={`nav-item ${page===item.label?'active':''}`}><item.icon size={18}/><span>{item.label}</span>{item.label==='Coordination'&&<span className="nav-count">{ambs.length}</span>}</button>)}</nav><div className="nav-label system-label">SYSTEM</div><button className="nav-item" onClick={()=>notify('Settings are part of the demo interface.')}><Settings2 size={18}/><span>Settings</span></button><button className="nav-item" onClick={()=>notify('Help center is not connected in demo mode.')}><CircleHelp size={18}/><span>Help & support</span></button><div className="sidebar-spacer"/><div className="system-status"><div className="status-top"><span className="pulse-dot"/> SYSTEM OPERATIONAL</div><div className="status-row"><span>Signal network</span><strong>Online</strong></div><div className="status-row"><span>AI priority engine</span><strong>Active</strong></div><div className="status-bar"><span/></div><div className="status-caption">{apiStatus} · Simulation mode</div></div><button className="profile-card" onClick={()=>setShowProfile(!showProfile)}><div className="avatar">OP</div><div className="profile-info"><strong>Control Operator</strong><span>Dispatch administrator</span></div><MoreHorizontal size={18}/></button>{showProfile&&<div className="profile-pop"><strong>Operator session</strong><span>{email}</span><button onClick={()=>{localStorage.removeItem('pulseroute_token');setAuthenticated(false);setApiStatus('Disconnected');setShowProfile(false)}}><LogOut size={15}/> Sign out</button></div>}</aside>
    <main className="main-area"><header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-btn" onClick={()=>setMobileMenu(!mobileMenu)}><Menu size={20}/></button><div><div className="breadcrumb">Workspace <span>/</span> <strong>{page}</strong></div><div className="page-heading">{page==='Overview'?'Emergency overview':page==='Live Map'?'Live operations map':page==='Coordination'?'Ambulance coordination':'Traffic recovery'}</div></div></div><div className="topbar-actions"><div className="network-pill"><span className="pulse-dot"/> All systems normal</div><button className="icon-btn notification-btn" onClick={()=>{setAlerts(!alerts);notify(alerts?'Alert notifications muted':'Alert notifications enabled')}} aria-label="Toggle alerts"><Bell size={18}/>{alerts&&<i/>}</button><div className="top-avatar">OP</div></div></header>
    <div className="content-area">
      <div className="welcome-row"><div><div className="eyebrow"><span className="pulse-dot"/> LIVE SIMULATION <span className="live-time">· 14:32:08 IST</span></div><h1>{page==='Overview'?'Good afternoon, Operator':page==='Live Map'?'City traffic overview':page==='Coordination'?'Priority coordination': 'Signal recovery center'}</h1><p>Monitor active emergencies and keep every route moving safely.</p></div><div className="welcome-actions"><button className={`secondary-btn ${running?'is-running':''}`} onClick={()=>{setRunning(!running);notify(running?'Simulation paused':'Simulation resumed')}}>{running?<Pause size={16}/>:<Play size={16}/>} {running?'Pause simulation':'Resume simulation'}</button><button className="primary-btn" onClick={()=>setShowAdd(true)}><Plus size={17}/> New emergency</button></div></div>
      <section className="metric-grid"><Metric icon={Ambulance} label="Active ambulances" value={String(ambs.length).padStart(2,'0')} change="2 critical priority" tone="red" trend="up"/><Metric icon={Signal} label="Signals coordinated" value={`${signals.length.toString().padStart(2,'0')}/${signals.length.toString().padStart(2,'0')}`} change="Network connected" tone="blue"/><Metric icon={Clock3} label="Avg. response ETA" value="07:24" change="−18% vs baseline" tone="green" trend="down"/><Metric icon={Gauge} label="Traffic flow recovery" value="86%" change="+12% this hour" tone="purple" trend="up"/></section>
      {page==='Overview'&&<><section className="main-grid"><div className="panel map-panel"><div className="panel-header"><div><h3>Live city map</h3><p>Ambulance routes & intersection status</p></div><div className="map-header-actions"><span className="map-live"><span className="pulse-dot"/> LIVE</span><button className="icon-btn small" onClick={()=>setPage('Live Map')} aria-label="Open full map"><ArrowUpRight size={17}/></button></div></div><TrafficMap ambs={ambs} signals={signals} running={running}/><div className="map-legend"><span><i className="legend-dot ambulance-dot"/> Ambulance</span><span><i className="legend-dot green-dot"/> Priority green</span><span><i className="legend-dot red-dot"/> Signal stop</span><span><i className="legend-dot yellow-dot"/> Recovery</span></div></div><div className="panel priority-panel"><div className="panel-header"><div><h3>Priority queue</h3><p>AI-ranked emergency requests</p></div><span className="count-badge">{ambs.length} active</span></div><div className="ai-recommendation"><div className="ai-rec-icon"><Sparkles size={16}/></div><div className="ai-rec-copy"><span>NEXT RECOMMENDATION</span><strong>{recommendation ? `${recommendation.id} · ${recommendation.severity}` : 'No pending requests'}</strong><small>{recommendation ? `Score ${recommendation.score}/100 · ${recommendation.eta} ETA · ${recommendation.targetSignalId || 'nearest signal'}` : 'All requests completed'}</small></div>{recommendation&&<button className="ai-rec-action" onClick={()=>grantPriority(recommendation.id)}>Apply <ArrowUpRight size={13}/></button>}</div><div className="queue-list">{priority.slice(0,4).map((a,i)=><div className="queue-item" key={a.id}><div className={`severity-indicator ${a.severity.toLowerCase()}`}/><div className="queue-main"><div className="queue-title"><strong>{a.id}</strong><span className={`severity-tag ${a.severity.toLowerCase()}`}>{a.severity}</span></div><span className="queue-desc">{a.patient}</span><div className="queue-meta"><span><Clock3 size={12}/> {a.eta} ETA</span><span><Navigation size={12}/> {a.distance}</span></div></div><div className="score-box"><strong>{a.score}</strong><span>score</span></div></div>)}</div><button className="panel-link" onClick={()=>setPage('Coordination')}>View coordination queue <ArrowUpRight size={15}/></button></div></section><section className="bottom-grid"><div className="panel ambulance-panel"><div className="panel-header"><div><h3>Active ambulance units</h3><p>Current dispatch status</p></div><button className="panel-link inline-link" onClick={()=>setPage('Coordination')}>View all <ArrowUpRight size={14}/></button></div><AmbulanceTable ambs={priority.slice(0,3)} onPriority={grantPriority}/></div><div className="panel signals-panel"><div className="panel-header"><div><h3>Intersection status</h3><p>Connected traffic signals</p></div><span className="signal-count"><span className="pulse-dot"/> {signals.length} online</span></div><div className="signal-list">{signals.slice(0,3).map(s=><SignalRow key={s.id} signal={s}/>)}</div><button className="panel-link" onClick={()=>setPage('Traffic Recovery')}>Manage signal recovery <ArrowUpRight size={15}/></button></div></section></>}
      {page==='Live Map'&&<section className="panel full-map-panel"><div className="panel-header"><div><h3>Live operations map</h3><p>Simulated city grid · Select a unit below to focus its route</p></div><span className="map-live"><span className="pulse-dot"/> {running?'LIVE SIMULATION':'SIMULATION PAUSED'}</span></div><TrafficMap ambs={ambs} signals={signals} running={running} large/><div className="map-legend"><span><i className="legend-dot ambulance-dot"/> Ambulance</span><span><i className="legend-dot green-dot"/> Priority green</span><span><i className="legend-dot red-dot"/> Signal stop</span><span><i className="legend-dot yellow-dot"/> Recovery</span></div><div className="unit-focus-grid">{ambs.map(a=><div className="unit-focus" key={a.id}><div className="unit-focus-top"><span className="unit-mini-icon"><Ambulance size={17}/></span><strong>{a.id}</strong><span className={`severity-tag ${a.severity.toLowerCase()}`}>{a.severity}</span></div><p>{a.route}</p><div className="unit-focus-bottom"><span><Clock3 size={13}/> {a.eta} ETA</span><button onClick={()=>grantPriority(a.id)}>Grant priority <ArrowUpRight size={13}/></button></div></div>)}</div></section>}
      {page==='Coordination'&&<><section className="coord-summary"><div className="panel coord-note"><div className="coord-icon"><Sparkles size={20}/></div><div><h3>AI priority engine</h3><p>Rule-based scores update from severity, ETA, distance, and nearby competing requests. This is a transparent demonstration model—not a trained or clinically validated AI system.</p></div><span className="engine-badge"><span className="pulse-dot"/> Active</span></div></section><section className="panel table-panel"><div className="panel-header"><div><h3>Emergency dispatch queue</h3><p>Review requests and grant signal priority</p></div><div className="table-tools"><div className="search-box"><Search size={15}/><input placeholder="Search units..." value={query} onChange={e=>setQuery(e.target.value)}/></div><button className="secondary-btn compact" onClick={()=>setQuery('')}><SlidersHorizontal size={15}/> Reset</button></div></div><AmbulanceTable ambs={filtered} onPriority={grantPriority} expanded/><div className="table-footer">Showing {filtered.length} of {ambs.length} active units <span>Scores recalculate when requests or signal states change.</span></div></section><section className="panel priority-logic"><div className="panel-header"><div><h3>Priority decision factors</h3><p>Illustrative weighted model</p></div><span className="count-badge">100 points</span></div><div className="factor-grid"><Factor label="Emergency severity" value={40} color="red" desc="Critical / high / moderate"/><Factor label="ETA to intersection" value={25} color="blue" desc="Closer units gain urgency"/><Factor label="Route conflict" value={20} color="purple" desc="Avoid competing green phases"/><Factor label="Signal readiness" value={15} color="green" desc="Safe transition availability"/></div></section><section className="coord-lower-grid"><div className="panel event-panel"><div className="panel-header"><div><h3>Decision event log</h3><p>Recent simulated dispatch decisions</p></div><span className="count-badge">{eventLog.length} events</span></div><div className="event-list">{eventLog.map(event=><div className="event-row" key={event.id}><span className={`event-icon ${event.type}`}><Activity size={14}/></span><div><strong>{event.message}</strong><span>{event.time}</span></div></div>)}</div></div><div className="panel conflict-panel"><div className="panel-header"><div><h3>Route conflict monitor</h3><p>Nearby units may compete for the same corridor</p></div><span className={`conflict-count ${routeConflicts.length?'has-conflicts':''}`}>{routeConflicts.length} flagged</span></div>{routeConflicts.length ? <div className="conflict-list">{routeConflicts.slice(0,4).map(a=><div className="conflict-row" key={a.id}><span className="conflict-dot"/><div><strong>{a.id}</strong><span>{a.conflictCount ? `${a.conflictCount} nearby competing request(s)` : `Shares corridor ${a.targetSignalId || ''}`}</span></div><b>{a.score}</b></div>)}</div> : <div className="conflict-empty"><ShieldCheck size={22}/><strong>No active route conflicts</strong><span>Current requests can be coordinated without a detected corridor conflict.</span></div>}<div className="conflict-foot">Conflict flags are based on simulated map proximity.</div></div></section></>}
      {page==='Traffic Recovery'&&<><section className="recovery-banner"><div className="recovery-symbol"><RefreshCw size={25}/></div><div className="recovery-copy"><div className="eyebrow">POST-EMERGENCY TRAFFIC CONTROL</div><h2>Restore the city’s normal rhythm.</h2><p>After an ambulance clears an intersection, the recovery sequence releases emergency overrides and returns signals to their adaptive cycle.</p></div><button className="primary-btn" onClick={recoverTraffic}><RefreshCw size={16}/>{recoveryStage==='clearance'?'Confirm clear & restore':'Start clearance check'}</button></section><section className="metric-grid recovery-metrics"><Metric icon={TrafficCone} label="Signals in recovery" value={String(signals.filter(s=>s.light==='yellow').length).padStart(2,'0')} change="Clearance checks" tone="purple"/><Metric icon={Activity} label="Normal-cycle signals" value={String(signals.filter(s=>s.state==='Normal cycle').length).padStart(2,'0')} change="Ready for traffic" tone="green"/><Metric icon={Clock3} label="Recovery target" value="≤ 45s" change="Illustrative target" tone="blue"/><Metric icon={ShieldCheck} label="Safety checks" value="04/04" change="Simulation checks pass" tone="green"/></section><section className="panel recovery-panel"><div className="panel-header"><div><h3>Intersection recovery monitor</h3><p>Two-stage recovery: clearance phase, then operator confirmation</p></div><button className="secondary-btn compact" onClick={()=>{setSignals(initialSignals.map(s=>({...s})));setRecoveryStage('idle')}}><RefreshCw size={14}/> Reset demo</button></div><div className="recovery-list">{signals.map((s,i)=><div className="recovery-row" key={s.id}><div className={`signal-icon ${s.light}`}><TrafficCone size={20}/></div><div className="recovery-intersection"><strong>{s.name}</strong><span>{s.id} · {s.mode}</span></div><div className="recovery-state"><span className={`light-pill ${s.light}`}><i/> {s.state}</span><span className="recovery-step">{s.state==='Recovery phase'?'Checking clearance':s.state==='Priority green'?'Emergency override active':'Adaptive cycle ready'}</span></div><button className="secondary-btn compact" onClick={()=>{setSignals(prev=>prev.map(x=>x.id===s.id?{...x,light:'green',state:'Normal cycle',mode:'Adaptive control'}:x));apiRequest(`/api/signals/${encodeURIComponent(s.id)}`,{method:'PATCH',body:JSON.stringify({light:'green',state:'Normal cycle',mode:'Adaptive control'})}).then(()=>notify(`${s.id} recovery saved to MongoDB`)).catch(error=>notify(`Signal changed locally but could not save: ${error.message}`));logEvent(`${s.id} manually restored to normal cycle`,'recovery')}}><Check size={14}/> Restore</button></div>)}</div><div className="recovery-bottom"><div><ShieldCheck size={16}/><span><strong>Safety-first rule</strong> — only restore a signal after confirming the emergency vehicle has cleared the intersection.</span></div><button className="primary-btn" onClick={recoverTraffic}><Check size={16}/>{recoveryStage==='clearance'?'Confirm clear & restore':'Start clearance check'}</button></div></section><section className="panel timeline-panel"><div className="panel-header"><div><h3>Recovery sequence</h3><p>Illustrative control workflow</p></div></div><div className="timeline">{[{n:'01',title:'Ambulance clears intersection',desc:'Vehicle position confirms exit from conflict zone',done:true},{n:'02',title:'Clearance and conflict check',desc:'Verify no other ambulance requires the same phase',done:true},{n:'03',title:'Release emergency override',desc:'Remove priority request from the controller',done:false},{n:'04',title:'Resume adaptive signal cycle',desc:'Rebalance the phase plan for waiting traffic',done:false}].map(t=><div className={`timeline-step ${t.done?'done':''}`} key={t.n}><div className="timeline-node">{t.done?<Check size={14}/>:t.n}</div><div><strong>{t.title}</strong><span>{t.desc}</span></div></div>)}</div></section></>}
      <footer className="app-footer"><span>PulseRoute <span className="footer-sep">·</span> Emergency traffic intelligence</span><span><span className="pulse-dot"/> Simulation mode <span className="footer-sep">·</span> Not connected to live infrastructure</span></footer>
    </div></main>
    {mobileMenu&&<div className="mobile-scrim" onClick={()=>setMobileMenu(false)}/>}
    {showAdd&&<div className="modal-backdrop" onClick={()=>setShowAdd(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-header"><div><div className="eyebrow">DISPATCH MANAGEMENT</div><h2>Register emergency</h2><p>Add a simulated ambulance request to the priority queue.</p></div><button className="icon-btn" onClick={()=>setShowAdd(false)}><X size={18}/></button></div><form onSubmit={addAmbulance}><label>Emergency severity</label><div className="severity-options">{['Critical','High','Moderate'].map(s=><button type="button" key={s} onClick={()=>setNewSeverity(s)} className={`severity-option ${s.toLowerCase()} ${newSeverity===s?'selected':''}`}><span className={`severity-indicator ${s.toLowerCase()}`}/>{s}{newSeverity===s&&<Check size={14}/>}</button>)}</div><label htmlFor="location">Pickup location</label><input id="location" className="modal-input" value={newLocation} onChange={e=>setNewLocation(e.target.value)} required/><div className="modal-hint"><Zap size={14}/> Priority score is estimated from severity and simulated route conditions.</div><div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>setShowAdd(false)}>Cancel</button><button className="primary-btn" type="submit"><Plus size={16}/> Add to dispatch</button></div></form></div></div>}
    {toast&&<div className="toast"><Check size={16}/>{toast}</div>}
  </div>;
}
function Metric({icon:Icon,label,value,change,tone,trend}) { return <div className="metric-card"><div className="metric-top"><span className={`metric-icon ${tone}`}><Icon size={18}/></span>{trend&&<span className={`metric-trend ${trend}`} >{trend==='down'?<ArrowDownRight size={13}/>:<ArrowUpRight size={13}/>} {trend==='down'?'Improving':'Trending'}</span>}</div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-change"><span className="change-dot"/>{change}</div></div> }
function TrafficMap({ambs,signals,running,large=false}) { return <div className={`traffic-map ${large?'traffic-map-large':''}`}><div className="map-top-label"><MapPinned size={13}/> CENTRAL CITY GRID <span>SIMULATED</span></div><div className="map-area"><svg className="road-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Simulated city map with roads and emergency vehicles"><defs><pattern id="blocks" width="16" height="16" patternUnits="userSpaceOnUse"><rect x="1" y="1" width="13" height="13" rx="1.2" fill="#111f30" stroke="#1a2b3d" strokeWidth=".35"/><path d="M3 4h8M3 6h6" stroke="#1a2b3d" strokeWidth=".45"/></pattern></defs><rect width="100" height="100" fill="url(#blocks)"/><g stroke="#26374a" strokeWidth="7" fill="none"><path d="M-5 20 L105 20"/><path d="M-5 45 L105 45"/><path d="M-5 70 L105 70"/><path d="M20 -5 L20 105"/><path d="M47 -5 L47 105"/><path d="M74 -5 L74 105"/><path d="M91 -5 L91 105"/></g><g stroke="#4b5c6e" strokeWidth=".35" strokeDasharray="1.5 1.5" fill="none"><path d="M-5 20 L105 20"/><path d="M-5 45 L105 45"/><path d="M-5 70 L105 70"/><path d="M20 -5 L20 105"/><path d="M47 -5 L47 105"/><path d="M74 -5 L74 105"/><path d="M91 -5 L91 105"/></g><path d="M5 88 Q22 79 32 63 T50 45 T68 30 T96 8" stroke="#102d42" strokeWidth="9" fill="none"/><path d="M5 88 Q22 79 32 63 T50 45 T68 30 T96 8" stroke="#29465d" strokeWidth=".5" strokeDasharray="2 1" fill="none"/><path d={`M${ambs[0]?.x||20} ${ambs[0]?.y||58} Q27 54 34 45 T47 45`} stroke="#ff5b6e" strokeWidth=".7" strokeDasharray="1.6 1.1" fill="none" opacity=".9"/><path d={`M${ambs[1]?.x||48} ${ambs[1]?.y||29} Q54 31 61 40 T74 45`} stroke="#f6b94a" strokeWidth=".7" strokeDasharray="1.6 1.1" fill="none" opacity=".85"/><path d={`M${ambs[2]?.x||73} ${ambs[2]?.y||71} Q61 72 47 75 T34 70`} stroke="#48d6b0" strokeWidth=".7" strokeDasharray="1.6 1.1" fill="none" opacity=".8"/></svg>{signals.map(s=><div key={s.id} className={`map-signal ${s.light}`} style={{left:`${s.x}%`,top:`${s.y}%`}} title={`${s.id}: ${s.state}`}><span className="signal-head"><i/><i/><i/></span></div>)}{ambs.map(a=><div key={a.id} className="map-ambulance" style={{left:`${a.x}%`,top:`${a.y}%`}} title={`${a.id} · ${a.severity}`}><span className="vehicle-halo" style={{borderColor:a.color}}/><span className="vehicle-marker" style={{background:a.color}}><Ambulance size={14}/></span><span className="vehicle-label">{a.id}</span></div>)}<div className="map-place place-hospital"><HeartPulse size={12}/> CITY HOSPITAL</div><div className="map-place place-center">CENTRAL MARKET</div><div className="map-compass"><Navigation size={14}/><span>N</span></div>{!running&&<div className="map-paused"><Pause size={16}/> SIMULATION PAUSED</div>}</div><div className="map-bottom-label"><span><span className="pulse-dot"/> GPS SIMULATION ACTIVE</span><span>Illustrative map · Not for real dispatch</span></div></div> }
function AmbulanceTable({ambs,onPriority,expanded=false}) { return <div className="table-scroll"><table className="data-table"><thead><tr><th>UNIT / ID</th><th>SEVERITY</th><th>DESTINATION / ROUTE</th><th>ETA</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{ambs.map(a=><tr key={a.id}><td><div className="unit-cell"><span className="unit-icon"><Ambulance size={16}/></span><div><strong>{a.id}</strong><span>{a.name}</span></div></div></td><td><span className={`severity-tag ${a.severity.toLowerCase()}`}><i/> {a.severity}</span></td><td><div className="route-cell"><strong>{a.route.split(' → ')[1]||'City Hospital'}</strong><span>{a.route.split(' → ')[0]}</span></div></td><td><strong className="eta-value">{a.eta}</strong><span className="table-sub">{a.distance}</span></td><td><span className={`status-tag ${a.status.toLowerCase().replaceAll(' ','-')}`}><i/>{a.status}</span></td><td><button className={`action-btn ${a.status==='Priority granted'?'granted':''}`} onClick={()=>onPriority(a.id)}>{a.status==='Priority granted'?<><Check size={13}/> Granted</>:<>Prioritize <ArrowUpRight size={13}/></>}</button></td></tr>)}</tbody></table>{ambs.length===0&&<div className="empty-state">No units match that search.</div>}</div> }
function SignalRow({signal}) { return <div className="signal-row"><div className={`signal-icon ${signal.light}`}><TrafficCone size={17}/></div><div className="signal-info"><strong>{signal.name}</strong><span>{signal.id} · {signal.mode}</span></div><div className={`traffic-light ${signal.light}`}><i/><i/><i/></div></div> }
function Factor({label,value,color,desc}) { return <div className="factor"><div className="factor-top"><strong>{label}</strong><b>{value}%</b></div><div className="factor-track"><span className={color} style={{width:`${value}%`}}/></div><span className="factor-desc">{desc}</span></div> }

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
