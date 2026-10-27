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

The login screen is prefilled with demo credentials. Click **Enter command center**. This is a UI-only demo login; it does not authenticate against a server.

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
- Authentication, user accounts, persistence, and backend APIs are not implemented.
- Never use the prototype to make real emergency dispatch or traffic-control decisions.

## Main files

- `src/main.jsx` — React app, demo data, views and interactions
- `src/priorityEngine.js` — scoring, ranking, recommendation and conflict detection
- `src/styles.css` — responsive dark navy dashboard styling
