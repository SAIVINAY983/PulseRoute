# PulseRoute — AI-Based Multi-Ambulance Priority and Traffic Recovery System

A React + Vite frontend prototype for demonstrating coordinated emergency dispatch using simulated ambulance positions and traffic signals.

## Run locally

Requirements: Node.js 18+ and npm.

```bash
npm install
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`). For a production build:

```bash
npm run build
npm run preview
```

## Demo access

The login screen is prefilled with demo credentials. Click **Enter command center**. The frontend authenticates against the Express API using a demo operator account.

## Priority engine

`src/priorityEngine.js` contains a transparent, deterministic rule-based scoring model. It scores requests using:

- Emergency severity (up to 40 points)
- ETA to the next intersection (up to 25 points)
- Distance (up to 15 points)
- Waiting status (up to 10 points)
- Signal readiness (up to 10 points)
- A penalty for nearby competing requests targeting the same simulated intersection

The coordination view ranks pending requests, displays a recommended request, and flags possible route conflicts. Scores recalculate as the simulated data changes.

## Two-stage traffic recovery

1. Click **Start clearance check** after an emergency priority has been granted. The active priority signal changes to yellow / recovery phase.
2. After confirming in this demo that the intersection is clear, click **Confirm clear & restore**. The demo releases the override and returns signals to their normal adaptive-cycle state.

This is a simplified educational simulation. It does not verify physical vehicle clearance and must not control real traffic lights.

## Current scope and limitations

- Ambulance coordinates and traffic-signal states are simulated in the browser.
- The map is an illustrative city grid, not a live GPS map.
- The priority engine is rule-based, not a trained machine-learning model.
- Authentication and API-backed persistence are implemented for the demo; use strong secrets and additional hardening before any deployment.
- Never use the prototype to make real emergency dispatch or traffic-control decisions.

## Main files

- `src/main.jsx` — React app, demo data, views and interactions
- `src/priorityEngine.js` — scoring, ranking, recommendation and conflict detection
- `src/styles.css` — responsive dashboard and light/dark theme styling

## Backend integration (React + Express + MongoDB)

The frontend authenticates against the Express API and loads ambulance, signal, and event records from MongoDB. Creating an emergency, granting priority, restoring signals, event logging, and operator settings call the API. Settings are stored per operator in the `userSettings` collection and cached in the browser as a fallback.

### 1. Start MongoDB

Make sure the local MongoDB service is running on `mongodb://127.0.0.1:27017`.

### 2. Start the API

Open a terminal in the project root:

```powershell
cd server
npm install
Copy-Item .env.example .env
npm run dev
```

The API runs at `http://localhost:5000`. Check `http://localhost:5000/api/health`.

Demo operator login:

- Email: `operator@pulseroute.demo`
- Password: `demo1234`

### 3. Start the frontend

Open a second terminal in the project root (not in `server`):

```powershell
npm install
npm run dev
```

Open the Vite URL, usually `http://localhost:5173`.

If your frontend runs on a different port, set `CLIENT_ORIGIN` in `server/.env` to match it, and restart the API. To change the API URL for the frontend, copy root `.env.example` to root `.env`.


### Settings page

Open **Settings** in the sidebar to configure:

- Theme: dark navy, light, or system preference (applies immediately; save to persist to the operator account).
- Dashboard refresh: 10, 30, or 60 seconds for API-backed ambulance, signal, and event refreshes.
- Emergency notifications: in-app toast notifications when a new ambulance record is detected during polling.
- Alert sounds: unavailable in this version and intentionally kept off.

The preferences are saved to MongoDB per signed-in operator. A local browser cache is used if the settings API is temporarily unavailable.

### Important prototype limits

This is an educational simulation. The priority score is deterministic rule-based logic, positions are simulated, and the system is not connected to live GPS, real traffic data, or physical traffic controllers. Change the development JWT secret before any non-demo deployment; configure authentication, authorization, validation, and operational safety controls before exposing the API publicly.

## Help & Support

The sidebar's **Help & support** page contains four sections:

- **Guide** — operator workflows and troubleshooting FAQs.
- **System status** — polls `GET /api/health` every 15 seconds and displays API and MongoDB connection status.
- **Report a problem** — authenticated `POST /api/support/tickets` stores the report in MongoDB. Reports include category, severity, summary, description, operator identity, status, and creation time. `GET /api/support/tickets` lists the signed-in operator's recent tickets.
- **About** — project purpose, technology stack, included capabilities, and limitations.

Support reports are stored in the `supporttickets` MongoDB collection. The form does not send email or create tickets in an external issue tracker. Avoid including passwords, patient-identifying information, or other sensitive data in a report.

### Help & Support files changed

- `src/main.jsx` — Help & Support tab navigation, operator guide, FAQs, live health polling, report form submission, and About content.
- `src/styles.css` — responsive dark navy support layouts and light-theme compatibility.
- `server/index.js` — `SupportTicket` Mongoose model and authenticated create/list endpoints.
