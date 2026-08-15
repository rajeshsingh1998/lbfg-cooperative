# LBFG Cooperative — Online System

This is the online, central-database version of the uploaded LBFG React/JSX system.

## What is included
- React + Vite frontend
- Express backend
- PostgreSQL central database
- Secure HTTP-only login session with JWT
- Password hashing with bcrypt
- Central members / transactions / loans / login-log / logo storage
- Responsive mobile + desktop UI
- Excel export from the existing application

## Run locally
1. Install Node.js 20+.
2. Create a PostgreSQL database.
3. Copy `.env.example` to `.env`.
4. Set `DATABASE_URL` and a long random `JWT_SECRET`.
5. Run `npm install`.
6. Run `npm run dev` for frontend development (API must be served by the backend in production), or:
   - `npm run build`
   - `npm start`
7. Open the URL shown by the server.

## Deploy online
Use a host that supports Node.js + PostgreSQL (for example Render, Railway, Fly.io, or your own VPS). Set:
- `DATABASE_URL`
- `JWT_SECRET`
- `NODE_ENV=production`

Build command: `npm install && npm run build`
Start command: `npm start`

Attach a managed PostgreSQL database and put its connection string in `DATABASE_URL`.

## Initial demo accounts
- admin / admin123
- manager / manager123
- accountant / account123
- staff / staff123
- member1 / member123

Change these passwords before real cooperative use.

## Important
This package is a deployment-ready foundation, not a completed production audit. Before storing real member financial/citizenship data, add HTTPS, backups, audit controls, user-management API, password reset, 2FA, stronger role/row-level permissions, and privacy/compliance controls.
