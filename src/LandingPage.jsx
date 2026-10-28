import React, { useState } from 'react';
import {
  Activity, Ambulance, ArrowRight, ArrowUpRight, Check, ChevronRight, Clock,
  Cpu, Gauge, GitMerge, HeartPulse, LayoutDashboard, LogIn, MapPin, Menu,
  Navigation, Plus, Radio, RefreshCw, Route, Server, Shield, ShieldAlert,
  ShieldCheck, Siren, Sparkles, TrafficCone, Users, X, Zap
} from 'lucide-react';
import './landing.css';

const demoInitialAmbulances = [
  { id: 'AMB-104', name: 'Unit 104', severity: 'Critical', patient: 'Cardiac emergency', eta: '04 min', distance: '2.1 km', speed: '42 km/h', route: 'North Avenue → City Hospital', status: 'Priority granted', color: '#ff5364', score: 96 },
  { id: 'AMB-208', name: 'Unit 208', severity: 'High', patient: 'Road accident', eta: '07 min', distance: '3.8 km', speed: '36 km/h', route: 'Market Road → Trauma Centre', status: 'Awaiting priority', color: '#f6b94a', score: 82 },
  { id: 'AMB-315', name: 'Unit 315', severity: 'Moderate', patient: 'Respiratory distress', eta: '11 min', distance: '6.4 km', speed: '31 km/h', route: 'University Road → General Hospital', status: 'Approaching', color: '#38d9a9', score: 64 },
];

export default function LandingPage({
  onLaunchCommand,
  onOpenLogin,
  onOpenHelp,
  onOpenSettings,
  authenticated = false,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Live Simulation state
  const [simAmbs, setSimAmbs] = useState(demoInitialAmbulances);
  const [simDecisionCount, setSimDecisionCount] = useState(14);
  const [simRecoveryCount, setSimRecoveryCount] = useState(8);
  const [simCoordinatedCount, setSimCoordinatedCount] = useState(19);
  const [simLog, setSimLog] = useState([
    { id: 1, time: '14:32:10', msg: 'AMB-104 priority green granted on North Ave corridor', type: 'priority' },
    { id: 2, time: '14:30:45', msg: 'Traffic clearance check initiated at Central Intersection', type: 'recovery' },
    { id: 3, time: '14:28:12', msg: 'Simulation initialized · 3 units on active tracking', type: 'system' },
  ]);

  const addSimEmergency = () => {
    const severities = ['Critical', 'High', 'Moderate'];
    const selectedSeverity = severities[Math.floor(Math.random() * severities.length)];
    const idNum = Math.floor(400 + Math.random() * 500);
    const newId = `AMB-${idNum}`;
    const score = selectedSeverity === 'Critical' ? 96 : selectedSeverity === 'High' ? 82 : 64;
    const color = selectedSeverity === 'Critical' ? '#ff5364' : selectedSeverity === 'High' ? '#f6b94a' : '#38d9a9';
    const emergencyTypes = [
      'Acute trauma incident', 'Severe respiratory shock', 'Cardiac arrest call',
      'Multi-vehicle collision', 'Pediatric emergency', 'Stroke alert'
    ];
    const patientDesc = emergencyTypes[Math.floor(Math.random() * emergencyTypes.length)];

    const newUnit = {
      id: newId,
      name: `Unit ${idNum}`,
      severity: selectedSeverity,
      patient: patientDesc,
      eta: `0${Math.floor(3 + Math.random() * 8)} min`,
      distance: `${(2.0 + Math.random() * 4).toFixed(1)} km`,
      speed: `${Math.floor(32 + Math.random() * 16)} km/h`,
      route: `East Gateway → City Hospital`,
      status: 'Awaiting priority',
      color,
      score,
    };

    setSimAmbs(prev => [newUnit, ...prev.slice(0, 4)]);
    setSimCoordinatedCount(c => c + 1);

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    setSimLog(prev => [
      { id: Date.now(), time: timeStr, msg: `New simulated emergency ${newId} registered (${selectedSeverity})`, type: 'new' },
      ...prev.slice(0, 5)
    ]);
  };

  const calculateSimPriority = () => {
    setSimAmbs(prev => {
      if (prev.length === 0) return prev;
      const sorted = [...prev].sort((a, b) => b.score - a.score);
      return sorted.map((unit, idx) => ({
        ...unit,
        status: idx === 0 ? 'Priority granted' : 'Awaiting priority',
      }));
    });
    setSimDecisionCount(c => c + 1);

    const highest = [...simAmbs].sort((a, b) => b.score - a.score)[0];
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    if (highest) {
      setSimLog(prev => [
        { id: Date.now(), time: timeStr, msg: `Priority corridor granted to ${highest.id} · Score ${highest.score}/100`, type: 'priority' },
        ...prev.slice(0, 5)
      ]);
    }
  };

  const simulateSimRecovery = () => {
    setSimAmbs(prev => prev.map(unit => ({
      ...unit,
      status: 'En route'
    })));
    setSimRecoveryCount(c => c + 1);

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    setSimLog(prev => [
      { id: Date.now(), time: timeStr, msg: 'Clearance confirmed · signals restored to normal adaptive cycle', type: 'recovery' },
      ...prev.slice(0, 5)
    ]);
  };

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="landing-container" id="home">
      <div className="landing-grid-bg" aria-hidden="true" />

      {/* 3. Navigation Bar */}
      <header className="lp-navbar" role="banner">
        <div className="lp-nav-inner">
          <a href="#home" onClick={(e) => { e.preventDefault(); scrollToSection('home'); }} className="lp-brand" aria-label="PulseRoute Home">
            <div className="lp-brand-mark">
              <Siren size={22} />
            </div>
            <span>Pulse<span>Route</span></span>
          </a>

          <nav className="lp-nav-links" aria-label="Main Navigation">
            <a href="#home" onClick={(e) => { e.preventDefault(); scrollToSection('home'); }}>Home</a>
            <a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}>Features</a>
            <a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollToSection('how-it-works'); }}>How It Works</a>
            <a href="#simulation" onClick={(e) => { e.preventDefault(); scrollToSection('simulation'); }}>Live Simulation</a>
            <a href="#about" onClick={(e) => { e.preventDefault(); scrollToSection('about'); }}>About</a>
          </nav>

          <div className="lp-nav-actions">
            <button
              type="button"
              className="lp-btn-login"
              onClick={authenticated ? onLaunchCommand : onOpenLogin}
              aria-label={authenticated ? 'Open Command Center' : 'Operator Login'}
            >
              <LogIn size={15} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
              {authenticated ? 'Operator Session' : 'Login'}
            </button>

            <button
              type="button"
              className="lp-btn-cta"
              onClick={onLaunchCommand}
              aria-label="Launch Command Center"
            >
              Launch Command Center
              <ArrowUpRight size={16} />
            </button>

            <button
              type="button"
              className="lp-mobile-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lp-mobile-menu">
            <a href="#home" onClick={(e) => { e.preventDefault(); scrollToSection('home'); }}>Home</a>
            <a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}>Features</a>
            <a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollToSection('how-it-works'); }}>How It Works</a>
            <a href="#simulation" onClick={(e) => { e.preventDefault(); scrollToSection('simulation'); }}>Live Simulation</a>
            <a href="#about" onClick={(e) => { e.preventDefault(); scrollToSection('about'); }}>About</a>
            <div className="lp-mobile-menu-actions">
              <button type="button" className="lp-btn-login" onClick={authenticated ? onLaunchCommand : onOpenLogin}>
                {authenticated ? 'Operator Session' : 'Login'}
              </button>
              <button type="button" className="lp-btn-cta" onClick={onLaunchCommand}>
                Launch Command Center <ArrowUpRight size={16} />
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 4. Hero Section */}
      <section className="lp-section lp-hero">
        <div className="lp-hero-grid">
          {/* Left Column */}
          <div className="lp-hero-left">
            <div className="lp-eyebrow">
              <span className="lp-dot-pulse" />
              INTELLIGENT EMERGENCY RESPONSE
            </div>

            <h1>
              Every Second Matters.<br />
              <span>Every Signal Counts.</span>
            </h1>

            <p className="lp-hero-desc">
              PulseRoute coordinates multiple emergency ambulances, ranks simultaneous requests through
              multi-factor priority scoring, detects corridor route conflicts, and automatically restores normal
              traffic flow once clearance is confirmed.
            </p>

            <div className="lp-hero-actions">
              <button type="button" className="lp-btn-cta" onClick={onLaunchCommand} style={{ padding: '12px 24px', fontSize: '15px' }}>
                Launch Command Center <ArrowUpRight size={17} />
              </button>
              <a
                href="#how-it-works"
                onClick={(e) => { e.preventDefault(); scrollToSection('how-it-works'); }}
                className="lp-btn-secondary"
              >
                Explore How It Works <ChevronRight size={16} />
              </a>
            </div>

            <div className="lp-hero-stats">
              <div className="lp-hero-stat">
                <strong>Multi-Ambulance</strong>
                <span>Real-time dispatch synchronization across metro routes</span>
              </div>
              <div className="lp-hero-stat">
                <strong>Severity Scoring</strong>
                <span>100-point deterministic clinical urgency index</span>
              </div>
              <div className="lp-hero-stat">
                <strong>Traffic Recovery</strong>
                <span>Two-stage clearance verification for adaptive signal cycles</span>
              </div>
            </div>
          </div>

          {/* Right Column: Custom Interactive Dashboard Preview */}
          <div className="lp-hero-right">
            <div className="lp-hero-preview">
              <div className="lp-preview-topbar">
                <div className="lp-preview-badge">
                  <span className="lp-dot-pulse" />
                  SIMULATION ACTIVE · CORRIDOR MONITOR
                </div>
                <div className="lp-preview-meta">METRO GRID S-04</div>
              </div>

              {/* City Map SVG Visualization */}
              <div className="lp-hero-map" role="img" aria-label="Simulated City Map Corridor Illustration">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                  {/* City blocks */}
                  <defs>
                    <pattern id="lp-grid-blocks" width="20" height="20" patternUnits="userSpaceOnUse">
                      <rect x="2" y="2" width="16" height="16" rx="2" fill="#0c1827" stroke="#16293f" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100" height="100" fill="url(#lp-grid-blocks)" />

                  {/* Roads */}
                  <g stroke="#1e344e" strokeWidth="6" fill="none">
                    <line x1="0" y1="28" x2="100" y2="28" />
                    <line x1="0" y1="62" x2="100" y2="62" />
                    <line x1="30" y1="0" x2="30" y2="100" />
                    <line x1="68" y1="0" x2="68" y2="100" />
                  </g>

                  {/* Road Center Dashed Lines */}
                  <g stroke="#395778" strokeWidth="0.6" strokeDasharray="2 2" fill="none">
                    <line x1="0" y1="28" x2="100" y2="28" />
                    <line x1="0" y1="62" x2="100" y2="62" />
                    <line x1="30" y1="0" x2="30" y2="100" />
                    <line x1="68" y1="0" x2="68" y2="100" />
                  </g>

                  {/* Route Corridor 1 (AMB-104: Coral Red Priority) */}
                  <path d="M 12 75 Q 30 70 30 45 T 68 28 T 92 18" fill="none" stroke="#ff5364" strokeWidth="1.6" strokeDasharray="3 2" opacity="0.9" />

                  {/* Route Corridor 2 (AMB-208: Amber) */}
                  <path d="M 45 15 Q 55 28 68 28 T 88 50" fill="none" stroke="#f6b94a" strokeWidth="1.2" strokeDasharray="3 2" opacity="0.75" />

                  {/* Route Corridor 3 (AMB-315: Green) */}
                  <path d="M 85 85 Q 68 78 68 62 T 30 62" fill="none" stroke="#38d9a9" strokeWidth="1.2" strokeDasharray="3 2" opacity="0.75" />

                  {/* Traffic Signal Heads at Intersections */}
                  {/* Intersection (30, 28) - Priority Green */}
                  <rect x="27.5" y="24" width="5" height="8" rx="1.5" fill="#07121e" stroke="#2a4563" strokeWidth="0.4" />
                  <circle cx="30" cy="26" r="1.2" fill="#38d9a9" filter="drop-shadow(0 0 2px #38d9a9)" />
                  <circle cx="30" cy="30" r="1.2" fill="#24374b" />

                  {/* Intersection (68, 28) - Red Hold */}
                  <rect x="65.5" y="24" width="5" height="8" rx="1.5" fill="#07121e" stroke="#2a4563" strokeWidth="0.4" />
                  <circle cx="68" cy="26" r="1.2" fill="#24374b" />
                  <circle cx="68" cy="30" r="1.2" fill="#ff5364" filter="drop-shadow(0 0 2px #ff5364)" />

                  {/* Intersection (30, 62) - Yellow Recovery */}
                  <rect x="27.5" y="58" width="5" height="8" rx="1.5" fill="#07121e" stroke="#2a4563" strokeWidth="0.4" />
                  <circle cx="30" cy="60" r="1.2" fill="#f6b94a" filter="drop-shadow(0 0 2px #f6b94a)" />
                  <circle cx="30" cy="64" r="1.2" fill="#24374b" />

                  {/* Ambulance Markers with Pulsing Glow */}
                  {/* AMB-104 Marker */}
                  <g transform="translate(30, 45)">
                    <circle cx="0" cy="0" r="5" fill="none" stroke="#ff5364" strokeWidth="0.8" opacity="0.6" />
                    <circle cx="0" cy="0" r="3" fill="#ff5364" />
                    <text x="0" y="-5" fill="#ff8d98" fontSize="3" fontWeight="bold" textAnchor="middle">AMB-104</text>
                  </g>

                  {/* AMB-208 Marker */}
                  <g transform="translate(68, 28)">
                    <circle cx="0" cy="0" r="4.5" fill="none" stroke="#f6b94a" strokeWidth="0.8" opacity="0.6" />
                    <circle cx="0" cy="0" r="2.8" fill="#f6b94a" />
                    <text x="0" y="-4.5" fill="#fbd38d" fontSize="3" fontWeight="bold" textAnchor="middle">AMB-208</text>
                  </g>

                  {/* AMB-315 Marker */}
                  <g transform="translate(68, 62)">
                    <circle cx="0" cy="0" r="4.5" fill="none" stroke="#38d9a9" strokeWidth="0.8" opacity="0.6" />
                    <circle cx="0" cy="0" r="2.8" fill="#38d9a9" />
                    <text x="0" y="7" fill="#6ee7b7" fontSize="3" fontWeight="bold" textAnchor="middle">AMB-315</text>
                  </g>
                </svg>

                {/* Floating Active Emergency Card */}
                <div className="lp-hero-card-active">
                  <div className="lp-card-icon-coral">
                    <HeartPulse size={18} />
                  </div>
                  <div>
                    <div className="lp-card-copy-top">
                      <strong>AMB-104</strong>
                      <span className="lp-tag-critical">Critical</span>
                    </div>
                    <div className="lp-card-sub">Cardiac emergency · 04m ETA</div>
                  </div>
                  <div className="lp-score-badge">
                    <strong>96</strong>
                    <span>Score</span>
                  </div>
                </div>

                {/* Bottom Queue Strip */}
                <div className="lp-hero-queue-strip">
                  <div className="lp-queue-unit">
                    <span className="lp-unit-dot" style={{ background: '#ff5364' }} />
                    <span>Unit 104 (Priority Corridor Active)</span>
                  </div>
                  <div className="lp-queue-unit">
                    <span className="lp-unit-dot" style={{ background: '#f6b94a' }} />
                    <span>Unit 208 (Holding 07m)</span>
                  </div>
                </div>
              </div>

              <div className="lp-disclaimer-bar">
                <ShieldCheck size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle', color: '#42d9ff' }} />
                <span>Simulated demonstration environment · Central city grid representation</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Features Section */}
      <section className="lp-section" id="features">
        <div className="lp-section-header">
          <div className="lp-eyebrow">COMMAND CAPABILITIES</div>
          <h2 className="lp-section-title">
            Smarter Decisions. <span>Faster Emergency Response.</span>
          </h2>
          <p className="lp-section-desc">
            PulseRoute bridges vehicle dispatch with intersection signal automation, replacing manual guesswork
            with deterministic, clinical priority logic and safety recovery workflows.
          </p>
        </div>

        <div className="lp-features-grid">
          {/* Feature 1 */}
          <div className="lp-feature-card">
            <div className="lp-feat-icon-wrap coral">
              <Ambulance size={26} />
            </div>
            <h3>Multi-Ambulance Coordination</h3>
            <p>
              Synchronize multiple emergency vehicles approaching shared intersections concurrently.
              Manage dispatch queues transparently without gridlock or conflicting priority phases.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="lp-feature-card">
            <div className="lp-feat-icon-wrap">
              <Sparkles size={26} />
            </div>
            <h3>Intelligent Priority Scoring</h3>
            <p>
              Rank requests using a weighted 100-point heuristic factoring clinical severity (40%),
              intersection ETA (25%), route distance (15%), and signal phase availability (20%).
            </p>
          </div>

          {/* Feature 3 */}
          <div className="lp-feature-card">
            <div className="lp-feat-icon-wrap coral">
              <ShieldAlert size={26} />
            </div>
            <h3>Route Conflict Detection</h3>
            <p>
              Identify competing units approaching the same corridor. Prevent catastrophic green-on-green
              phase assignments through automated route conflict detection and staging.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="lp-feature-card">
            <div className="lp-feat-icon-wrap">
              <Radio size={26} />
            </div>
            <h3>Traffic Signal Prioritization</h3>
            <p>
              Simulate dynamic preemption commands to downstream signal controllers, opening green-wave
              corridors that allow the highest-priority emergency unit to pass without stopping.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="lp-feature-card">
            <div className="lp-feat-icon-wrap green">
              <RefreshCw size={26} />
            </div>
            <h3>Two-Stage Traffic Recovery</h3>
            <p>
              Safely transition signals from emergency priority back to normal adaptive cycles using
              clearance verification to prevent sudden gridlock and allow waiting general traffic to clear.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="lp-feature-card">
            <div className="lp-feat-icon-wrap green">
              <Activity size={26} />
            </div>
            <h3>Emergency Analytics & Audit</h3>
            <p>
              Log every decision event, preemption grant, and recovery confirmation. Review response
              times and simulated network efficiency improvements with MongoDB-backed persistence.
            </p>
          </div>
        </div>
      </section>

      {/* 6. How It Works Section */}
      <section className="lp-section" id="how-it-works">
        <div className="lp-section-header">
          <div className="lp-eyebrow">FOUR-STAGE WORKFLOW</div>
          <h2 className="lp-section-title">
            How PulseRoute Operates
          </h2>
          <p className="lp-section-desc">
            From initial emergency request to post-passage signal normalization, every phase follows a
            structured, transparent control cycle.
          </p>
        </div>

        <div className="lp-steps-pipeline">
          <div className="lp-step-card">
            <div className="lp-step-badge">01</div>
            <div className="lp-step-icon"><Radio size={24} /></div>
            <h4>Detect</h4>
            <p>
              Emergency calls are ingested with patient condition, dispatch urgency, and projected GPS coordinates.
            </p>
          </div>

          <div className="lp-step-card">
            <div className="lp-step-badge">02</div>
            <div className="lp-step-icon"><Cpu size={24} /></div>
            <h4>Evaluate</h4>
            <p>
              The priority engine calculates an objective 100-point rank factoring severity, arrival ETA, and road distances.
            </p>
          </div>

          <div className="lp-step-card">
            <div className="lp-step-badge">03</div>
            <div className="lp-step-icon"><Route size={24} /></div>
            <h4>Coordinate</h4>
            <p>
              Identifies conflicting routes, holds lower-urgency units safely, and preempts intersection signals to priority green.
            </p>
          </div>

          <div className="lp-step-card">
            <div className="lp-step-badge">04</div>
            <div className="lp-step-icon"><ShieldCheck size={24} /></div>
            <h4>Recover</h4>
            <p>
              Verifies the ambulance has cleared the conflict zone, releases the override, and resumes adaptive signal cycles.
            </p>
          </div>
        </div>
      </section>

      {/* 7. Interactive Live Simulation Section */}
      <section className="lp-section" id="simulation">
        <div className="lp-section-header">
          <div className="lp-eyebrow coral">BROWSER RUNTIME DEMO</div>
          <h2 className="lp-section-title">
            Interactive Live Simulation
          </h2>
          <p className="lp-section-desc">
            Test the deterministic dispatch and recovery algorithm directly. Trigger new emergencies,
            recalculate priority scores, and observe the traffic recovery cycle.
          </p>
        </div>

        <div className="lp-sim-panel">
          <div className="lp-sim-topbar">
            <div className="lp-sim-title-group">
              <h3>Dispatch Priority Testbed</h3>
              <p>Simulated metropolitan intersection queue · Live heuristic evaluation</p>
            </div>
            <div className="lp-sim-actions">
              <button type="button" className="lp-btn-action primary" onClick={addSimEmergency}>
                <Plus size={15} /> Simulate Emergency
              </button>
              <button type="button" className="lp-btn-action" onClick={calculateSimPriority}>
                <Sparkles size={15} /> Calculate Priority
              </button>
              <button type="button" className="lp-btn-action green" onClick={simulateSimRecovery}>
                <RefreshCw size={15} /> Simulate Traffic Recovery
              </button>
            </div>
          </div>

          {/* Unit Cards Grid */}
          <div className="lp-sim-units-grid">
            {simAmbs.slice(0, 3).map((unit) => (
              <div
                key={unit.id}
                className={`lp-sim-unit-card ${unit.status === 'Priority granted' ? 'priority-active' : ''}`}
              >
                <div className="lp-unit-card-header">
                  <div className="lp-unit-title">
                    <span
                      style={{
                        width: 8, height: 8, borderRadius: '50%', background: unit.color,
                        boxShadow: `0 0 8px ${unit.color}`
                      }}
                    />
                    <strong>{unit.id}</strong>
                    <span style={{ fontSize: '11px', color: '#90a4bb' }}>({unit.name})</span>
                  </div>
                  <span
                    style={{
                      fontSize: '10px', fontWeight: 'bold', padding: '3px 7px', borderRadius: 4,
                      background: unit.severity === 'Critical' ? 'rgba(255,83,100,0.18)' : unit.severity === 'High' ? 'rgba(246,185,74,0.18)' : 'rgba(56,217,169,0.18)',
                      color: unit.color
                    }}
                  >
                    {unit.severity}
                  </span>
                </div>

                <div className="lp-unit-patient">{unit.patient}</div>

                <div className="lp-unit-metrics-row">
                  <div className="lp-unit-metric">
                    <span>Score</span>
                    <strong style={{ color: unit.color }}>{unit.score}</strong>
                  </div>
                  <div className="lp-unit-metric">
                    <span>ETA</span>
                    <strong>{unit.eta}</strong>
                  </div>
                  <div className="lp-unit-metric">
                    <span>Dist</span>
                    <strong>{unit.distance}</strong>
                  </div>
                </div>

                <div className="lp-unit-status-bar">
                  <span>{unit.route}</span>
                  <span
                    className={`lp-status-pill ${
                      unit.status === 'Priority granted' ? 'priority-granted' :
                      unit.status === 'En route' ? 'en-route' : 'awaiting'
                    }`}
                  >
                    {unit.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Real-time Event Feed */}
          <div className="lp-sim-log-wrap">
            <div className="lp-sim-log-head">
              <span>SIMULATION DECISION LOG</span>
              <span style={{ fontSize: '10px', color: '#5e758f' }}>Deterministic Frontend Heuristic</span>
            </div>
            <div className="lp-sim-log-list">
              {simLog.map((item) => (
                <div key={item.id} className="lp-log-item">
                  <span className="lp-log-time">{item.time}</span>
                  <span className="lp-log-msg">{item.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 8. Impact and Analytics Section */}
      <section className="lp-section">
        <div className="lp-section-header">
          <div className="lp-eyebrow">METRICS & ANALYTICS</div>
          <h2 className="lp-section-title">
            Simulation Analytics & Impact
          </h2>
          <p className="lp-section-desc">
            Real-time calculations derived directly from the simulation runtime. Transparent, uninflated demonstration metrics.
          </p>
        </div>

        <div className="lp-impact-grid">
          <div className="lp-impact-card">
            <div className="lp-impact-val coral">{String(simAmbs.length).padStart(2, '0')}</div>
            <div className="lp-impact-label">Active Emergencies</div>
            <div className="lp-impact-desc">Simulated requests currently tracked in queue</div>
          </div>

          <div className="lp-impact-card">
            <div className="lp-impact-val cyan">{simCoordinatedCount}</div>
            <div className="lp-impact-label">Ambulances Coordinated</div>
            <div className="lp-impact-desc">Total vehicle dispatch events handled this session</div>
          </div>

          <div className="lp-impact-card">
            <div className="lp-impact-val amber">{simDecisionCount}</div>
            <div className="lp-impact-label">Priority Decisions</div>
            <div className="lp-impact-desc">Multi-factor corridor ranking computations executed</div>
          </div>

          <div className="lp-impact-card">
            <div className="lp-impact-val green">{simRecoveryCount}</div>
            <div className="lp-impact-label">Traffic Recovery Cycles</div>
            <div className="lp-impact-desc">Signals safely restored to adaptive cycles</div>
          </div>
        </div>
      </section>

      {/* 9. About Section */}
      <section className="lp-section" id="about">
        <div className="lp-section-header">
          <div className="lp-eyebrow">PROJECT CONTEXT</div>
          <h2 className="lp-section-title">
            About PulseRoute
          </h2>
        </div>

        <div className="lp-about-grid">
          <div className="lp-about-box">
            <p>
              <strong>PulseRoute is a smart-city emergency traffic management prototype designed to explore
              coordinated ambulance prioritization, intersection conflict handling, and post-emergency
              traffic recovery.</strong>
            </p>
            <p>
              In dense metropolitan networks, emergency vehicles often face conflicting green phases or severe post-clearance
              gridlock. PulseRoute demonstrates an intelligent coordination layer between emergency dispatch telemetry and
              intersection traffic controllers.
            </p>
            <p style={{ fontSize: '13px', color: '#7a91aa', borderTop: '1px solid #1a2f47', paddingTop: '16px' }}>
              <strong>Notice:</strong> This prototype utilizes transparent rule-based heuristics and browser-simulated
              telemetry data. It is not connected to live GPS hardware, municipal traffic sensors, or clinical dispatch centers.
            </p>
          </div>

          <div className="lp-about-meta">
            <div className="lp-meta-row">
              <span>Prototype System</span>
              <strong>PulseRoute v0.2.0</strong>
            </div>
            <div className="lp-meta-row">
              <span>Frontend Architecture</span>
              <strong>React + Vite + Modern CSS</strong>
            </div>
            <div className="lp-meta-row">
              <span>Backend Architecture</span>
              <strong>Node.js + Express REST API</strong>
            </div>
            <div className="lp-meta-row">
              <span>Persistence Layer</span>
              <strong>MongoDB Local Database</strong>
            </div>
            <div className="lp-meta-row">
              <span>Priority Logic</span>
              <strong>Deterministic 100-Point Model</strong>
            </div>
            <div className="lp-meta-row">
              <span>Signal Recovery</span>
              <strong>Two-Stage Clearance Check</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Pre-Footer Action Banner */}
      <section className="lp-section" style={{ paddingBottom: 0 }}>
        <div className="lp-cta-banner">
          <h2>Ready to Explore the Command Center?</h2>
          <p>
            Experience the complete full-screen dashboard, live route simulation, coordination queue,
            and system settings.
          </p>
          <button type="button" className="lp-btn-cta" onClick={onLaunchCommand} style={{ padding: '14px 28px', fontSize: '15px' }}>
            Launch Command Center <ArrowUpRight size={17} />
          </button>
        </div>
      </section>

      {/* 10. Footer */}
      <footer className="lp-footer" role="contentinfo">
        <div className="lp-footer-grid">
          <div className="lp-footer-brand">
            <div className="lp-brand">
              <div className="lp-brand-mark">
                <Siren size={20} />
              </div>
              <span>Pulse<span>Route</span></span>
            </div>
            <p>
              Intelligent emergency vehicle prioritization and staged traffic recovery prototype for modern smart cities.
            </p>
          </div>

          <div className="lp-footer-col">
            <h5>Navigation</h5>
            <ul>
              <li><a href="#home" onClick={(e) => { e.preventDefault(); scrollToSection('home'); }}>Home</a></li>
              <li><a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}>Features</a></li>
              <li><a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollToSection('how-it-works'); }}>How It Works</a></li>
              <li><a href="#simulation" onClick={(e) => { e.preventDefault(); scrollToSection('simulation'); }}>Live Simulation</a></li>
              <li><a href="#about" onClick={(e) => { e.preventDefault(); scrollToSection('about'); }}>About Project</a></li>
            </ul>
          </div>

          <div className="lp-footer-col">
            <h5>Command Center</h5>
            <ul>
              <li><a onClick={onLaunchCommand}>Dashboard Overview</a></li>
              <li><a onClick={onLaunchCommand}>Live Operations Map</a></li>
              <li><a onClick={onLaunchCommand}>Priority Coordination</a></li>
              <li><a onClick={onLaunchCommand}>Traffic Recovery</a></li>
              <li><a onClick={onOpenSettings}>System Settings</a></li>
              <li><a onClick={onOpenHelp}>Help & Support</a></li>
            </ul>
          </div>

          <div className="lp-footer-col">
            <h5>Technology</h5>
            <ul>
              <li><a>React 18 + Vite</a></li>
              <li><a>Node.js + Express</a></li>
              <li><a>MongoDB Local</a></li>
              <li><a>JWT Authentication</a></li>
              <li><a onClick={authenticated ? onLaunchCommand : onOpenLogin}>{authenticated ? 'Operator Profile' : 'Operator Login'}</a></li>
            </ul>
          </div>
        </div>

        <div className="lp-footer-bottom">
          <div className="lp-footer-disclaimer">
            <strong>Disclaimer:</strong> PulseRoute is an educational prototype and research simulation. It is not certified
            or approved for real-world emergency dispatch or live traffic controller actuation.
          </div>
          <div>
            © 2026 PulseRoute. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
