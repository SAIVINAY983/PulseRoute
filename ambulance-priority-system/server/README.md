# PulseRoute API server

## Setup
1. Open a terminal in this `server` folder.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and change `JWT_SECRET` to a long random value.
4. Run `npm run dev`.

The server connects to `mongodb://127.0.0.1:27017/pulseroute` by default and seeds simulated demo records on first startup.

## Demo login
- Email: `operator@pulseroute.demo`
- Password: `demo1234`

## Endpoints
- `GET /api/health` (public)
- `POST /api/auth/login` (public)
- `POST /api/auth/register` (public)
- `GET /api/ambulances` (Bearer token required)
- `POST /api/ambulances` (Bearer token required)
- `PATCH /api/ambulances/:id` (Bearer token required)
- `GET /api/signals` (Bearer token required)
- `PATCH /api/signals/:id` (Bearer token required)
- `GET /api/events` (Bearer token required)
- `POST /api/events` (Bearer token required)

This backend is for a local project demonstration. Do not connect it to real traffic infrastructure or expose it publicly without production security review, authorization hardening, rate limiting, validation, and secure secret management.
