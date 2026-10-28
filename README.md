# PulseRoute — Smart-City Multi-Ambulance Priority & Traffic Recovery System

![PulseRoute Banner](https://images.unsplash.com/photo-1516762689617-e1cffcef479d?auto=format&fit=crop&w=1400&q=80)

> **Important Safety & Research Disclaimer:**  
> PulseRoute is an educational research and smart-city software simulation prototype. It does not interface with municipal emergency hardware (e.g., SCATS, SCOOT), live GPS satellites, or physical traffic signal controllers. Do not use this prototype for actual real-world emergency dispatch or traffic control operations.

---

## 1. Project Overview & Features

PulseRoute is a full-stack smart-city emergency dispatch and traffic management command center. It models how municipal emergency vehicles can receive deterministic green-corridor priority through congested urban intersections while guaranteeing safe two-stage clearance and rapid recovery to adaptive city traffic cycles.

### Key Capabilities
- **Emergency Operations Landing Page:** Smart-city portal featuring fleet telemetry, system architecture breakdown, priority engine walkthrough, and live simulation controls.
- **Advanced Command Center:** Real-time operational dashboard with fleet tracking, intersection signal monitors, live event logs, and status controls.
- **Explainable Deterministic Priority Engine:** 100-point transparent heuristic scoring based on clinical severity, ETA, distance, waiting time, and signal readiness with 5-tier deterministic tie-breaking.
- **Corridor Conflict Detection:** Flags multi-ambulance hazards where competing emergency vehicles approach the same intersection.
- **Two-Stage Traffic Recovery:** Strictly enforces a clearance phase (yellow caution hold) before restoring normal municipal traffic cycles.
- **Emergency Lifecycle & Timeline:** 7-stage chronological tracking from 911 intake to hospital handover.
- **Real-Time Event Notification Center:** SSE-driven live alerts with unread badges, critical soundless popovers, and immediate dispatch alerts.
- **Automated QA & Verification Test Runner:** In-app browser test runner executing 20+ automated assertions alongside standalone Node.js test suites.
- **Operator Preferences & Diagnostics:** Dark navy theme, customizable polling intervals, live service health checks, and MongoDB-backed problem ticketing.

---

## 2. Architecture & Technology Stack

```
                     ┌───────────────────────────────────────────────┐
                     │               PULSEROUTE CLIENT               │
                     │  React 18 + Vite · Lucide Icons · Vanilla CSS │
                     │   In-App Automated QA & Diagnostic Runner     │
                     └───────────────────────┬───────────────────────┘
                                             │
                       REST API Calls        │  Server-Sent Events (SSE)
                       (JWT Bearer)          │  Real-Time Stream
                                             ▼
                     ┌───────────────────────────────────────────────┐
                     │              EXPRESS REST SERVER              │
                     │  Node.js (ESM) · Dynamic CORS · Sliding Limit │
                     │  Input Sanitization · Mass-Assignment Guard   │
                     │  7-Stage Timeline Builder · Safe Error Shield │
                     └───────────────────────┬───────────────────────┘
                                             │
                             Mongoose ODM    │  Automatic Failover to
                             Connection      │  In-Memory Store
                                             ▼
                     ┌───────────────────────────────────────────────┐
                     │              MONGODB DATABASE                 │
                     │  Local Standalone or MongoDB Atlas (Cloud)   │
                     │  Collections: ambulances, signals, events,    │
                     │               notifications, settings, tickets│
                     └───────────────────────────────────────────────┘
```

- **Frontend:** React 18, Vite, Lucide React, Vanilla CSS (Dark Navy Emergency Operations Design System).
- **Backend API:** Node.js, Express 4.21 (ES Modules), jsonwebtoken, bcryptjs, cors, dotenv.
- **Database:** MongoDB 7.x via Mongoose 8.x (with resilient automatic in-memory fallback for offline/development mode).
- **Real-Time Transport:** Server-Sent Events (SSE) at `/api/realtime/stream` with heartbeat keepalives and automatic reconnection.
- **Test Infrastructure:** Node.js native test runner (`node:test`, `node:assert/strict`) and in-browser interactive QA test runner.

---

## 3. Installation & Local Setup

### Prerequisites
- Node.js 18.x or 20.x LTS
- npm 9.x or higher
- MongoDB (optional for demo, recommended for persistence): local instance or MongoDB Atlas URI

### Step 1: Clone & Configure Backend
```bash
# Navigate to backend directory
cd server

# Install backend dependencies
npm install

# Copy environment template
cp .env.example .env

# Start backend dev server
npm run dev
```
The API will initialize on `http://localhost:5000`. You can verify operational status at `http://localhost:5000/api/health`.

### Step 2: Configure & Start Frontend
```bash
# In the root repository directory
npm install

# Copy frontend environment template
cp .env.example .env.local

# Start Vite dev server
npm run dev
```
Open your browser to `http://localhost:5173`.

---

## 4. Environment Variables Reference

### Frontend Configuration (`.env.local`)
| Variable | Description | Default | Example |
|---|---|---|---|
| `VITE_API_BASE` | Base URL for PulseRoute backend API | `http://localhost:5000` | `https://api.pulseroute.com` |

### Backend Configuration (`server/.env`)
| Variable | Description | Default | Production Guideline |
|---|---|---|---|
| `PORT` | HTTP server port | `5000` | Assigned by cloud host or `5000` |
| `NODE_ENV` | Environment mode | `development` | Set to `production` (enables error masking) |
| `MONGODB_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/pulseroute` | Use MongoDB Atlas replica set URI |
| `JWT_SECRET` | Secret key for signing tokens | `development_only_change_me` | Use 64+ char random string |
| `CLIENT_ORIGIN` | Allowed CORS origins (comma-delimited) | `http://localhost:5173` | `https://app.pulseroute.com` |
| `ALLOW_DEMO_LOGIN` | Allows `operator@pulseroute.demo` | `true` | Set to `false` for public production |

---

## 5. API Endpoint Summary

All routes under `/api/*` except `/api/health` and `/api/auth/*` require a valid JWT passed via `Authorization: Bearer <token>`.

| Method | Endpoint | Description | Rate Limit |
|---|---|---|---|
| `GET` | `/api/health` | Service health, memory, uptime, DB state | None |
| `POST` | `/api/auth/register` | Register new operator account | 25 req / 15m |
| `POST` | `/api/auth/login` | Authenticate operator credentials | 25 req / 15m |
| `GET` | `/api/realtime/stream` | Server-Sent Events stream for live events | Auth required |
| `GET` | `/api/ambulances` | List fleet (supports `status`, `severity`, `page`, `limit`) | None |
| `POST` | `/api/ambulances` | Dispatch new emergency vehicle | 50 req / 1m |
| `PATCH` | `/api/ambulances/:id` | Update unit status, location, or destination | 50 req / 1m |
| `GET` | `/api/signals` | List intersection traffic signals | None |
| `PATCH` | `/api/signals/:id` | Update signal state (requires clearance confirmation) | 50 req / 1m |
| `GET` | `/api/notifications` | Get emergency alerts (supports `unreadOnly`, `page`) | None |
| `PATCH` | `/api/notifications/:id/read` | Mark alert as read | None |
| `POST` | `/api/notifications/read-all` | Mark all alerts read | None |
| `DELETE` | `/api/notifications` | Clear notifications log | None |
| `GET` | `/api/events` | Audit log of dispatch and signal events | None |
| `POST` | `/api/events` | Log event (with 6s deduplication window) | 50 req / 1m |
| `GET` | `/api/analytics` | Real-time computed metrics from stored data | None |
| `GET` | `/api/settings` | Get authenticated operator preferences | None |
| `PUT` | `/api/settings` | Save operator preferences | None |
| `GET` | `/api/support/tickets` | List user's submitted support reports | None |
| `POST` | `/api/support/tickets` | Submit problem report to MongoDB | 50 req / 1m |

---

## 6. How to Run Tests

### Method 1: In-App Interactive QA Verification Runner (Browser)
1. Launch the application and open **Help & Support** from the sidebar or landing page.
2. Click the **QA & Verification** tab.
3. Click **Run Automated QA Suite**.
4. The test runner executes 20+ automated assertions in real time with detailed verification metrics, assertion outputs, and execution duration.

### Method 2: Node.js Automated Test Suites (CLI)
From the repository root:
```bash
# Run all unit and integration test suites
npm test
```
To run specific test modules:
```bash
node --test test/priorityEngine.test.js
node --test test/workflowIntegrity.test.js
node --test test/security.test.js
node --test test/apiContract.test.js
```

---

## 7. Security Architecture

1. **Input Sanitization:** Strips null bytes (`\x00`), ASCII control characters, and leading/trailing whitespace.
2. **Mass-Assignment Protection:** Incoming payloads are filtered against strict whitelists before updating MongoDB documents.
3. **Sliding-Window Rate Limiting:**
   - Auth endpoints: 25 attempts per 15 minutes.
   - Write operations: 50 requests per minute.
   - Payload limit: Request body capped at 100kb to mitigate DoS.
4. **Password Hashing:** Passwords hashed with bcryptjs using salt factor 12.
5. **Token Verification:** Signed JWTs with strict expiration; protected routes reject unauthenticated requests with HTTP 401.
6. **Data Isolation:** User settings and support tickets query exclusively against the authenticated operator's user ID (`req.user.sub`).
7. **Production Error Masking:** Stack traces and internal database error messages are suppressed in production mode.
8. **Demo Login Production Toggle:** Set `ALLOW_DEMO_LOGIN=false` in production to completely disable the development bypass.

---

## 8. Production Deployment Guide

### A. Deploying the React Frontend (Vercel, Netlify, Cloudflare)
1. Push repository to GitHub.
2. In Vercel / Netlify dashboard, import repository with root directory `./`.
3. Set Build Command: `npm run build`.
4. Set Output Directory: `dist`.
5. Set Environment Variable:
   - `VITE_API_BASE`: `https://api.yourdomain.com` (your deployed backend URL).

### B. Deploying the Express Backend (Render, Railway, Fly.io, VPS)
1. Set Root Directory to `server`.
2. Set Build Command: `npm install`.
3. Set Start Command: `npm start` (or `node index.js`).
4. Set Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `5000` (or host-provided port)
   - `MONGODB_URI`: `mongodb+srv://<user>:<password>@cluster.mongodb.net/pulseroute?retryWrites=true&w=majority`
   - `JWT_SECRET`: Generate a secure 64-char key (`openssl rand -hex 32`)
   - `CLIENT_ORIGIN`: `https://your-frontend-app.vercel.app`
   - `ALLOW_DEMO_LOGIN`: `false`

### C. Database Setup (MongoDB Atlas)
1. Create a free M0 cluster at [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Under **Network Access**, whitelist your backend IP or `0.0.0.0/0` (with strong user credentials).
3. Under **Database Access**, create a user with read/write privileges to database `pulseroute`.
4. Copy connection string and paste into backend `MONGODB_URI`. PulseRoute will automatically seed initial ambulance units, signals, and demo records upon first launch.

---

## 9. Demo Workflow

1. **Access the Portal:** Visit `http://localhost:5173` to explore the Landing Page.
2. **Launch Command Center:** Click "Launch Command Center" or "Enter Command Center" to authenticate with prefilled demo credentials (`operator@pulseroute.demo` / `demo1234`).
3. **Dispatch Emergency:** Navigate to **Ambulance Fleet**, click **+ Dispatch Emergency**, select Severity (`Critical`), enter Location and Destination, and submit.
4. **Inspect Priority Calculation:** Switch to **Priority Engine** to see the 100-point transparent factor breakdown and verify tie-breaking logic.
5. **Activate Corridor Preemption:** Click **Grant Corridor Priority** to transition the target intersection to **Priority Green**.
6. **Initiate Two-Stage Recovery:**
   - Click **Start clearance check**: signal transitions to **Recovery phase** (yellow clearance).
   - Click **Confirm clear & restore**: restores intersection to normal adaptive cycling.
7. **View System Analytics:** Check **Analytics** to see live response time distributions and utilization percentages.
8. **Run Verification:** Open **Help & Support** -> **QA & Verification** and execute the automated test runner.

---

## 10. Screenshots

| Landing Page | Command Center Overview |
|:---:|:---:|
| ![Landing Page Preview](https://via.placeholder.com/600x340/07111f/42d9ff?text=PulseRoute+Landing+Page) | ![Command Center Preview](https://via.placeholder.com/600x340/07111f/ff5364?text=Emergency+Command+Center) |

| Priority Engine Breakdown | Two-Stage Traffic Recovery |
|:---:|:---:|
| ![Priority Engine Preview](https://via.placeholder.com/600x340/07111f/38d9a9?text=Deterministic+Priority+Engine) | ![Traffic Recovery Preview](https://via.placeholder.com/600x340/07111f/f6b94a?text=Two-Stage+Traffic+Recovery) |

---

## 11. License
Educational prototype for academic and portfolio demonstration. All rights reserved.
