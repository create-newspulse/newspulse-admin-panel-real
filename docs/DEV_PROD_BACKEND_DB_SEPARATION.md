# Dev/Prod Backend + DB Separation (Public Site Settings)

Problem: both the **local public site** (e.g. `http://localhost:3000`) and **production public site** (e.g. `https://www.newspulse.co.in`) read the *same* “Public Site Settings” document when they point at the same backend + MongoDB.

Goal:
- **Local Admin** (`http://localhost:5173`) + **Local Public** (`http://localhost:3000`) → **DEV backend + DEV DB**
- **Production Admin** (`https://admin.newspulse.co.in`) + **Production Public** (`https://www.newspulse.co.in`) → **PROD backend + PROD DB**

## 1) Create a DEV MongoDB database
Create a separate database/cluster (recommended) or at minimum a separate database name for DEV.

Example:
- PROD: `mongodb+srv://.../newspulse_prod`
- DEV:  `mongodb+srv://.../newspulse_dev`

The key requirement is: DEV backend must *not* use the PROD Mongo URI/database.

## 2) Run a DEV backend
You have two clean options:

### Option A — Local dev backend (recommended for safety)
Run the backend locally (default port `5000`) using the DEV Mongo URI.

Backend folder in this repo: `render-backend-real/`
- Copy `render-backend-real/.env.example` → `render-backend-real/.env`
- Set `MONGO_URI` to your **DEV** Mongo URI
- Start backend (from `render-backend-real/`):
  - `npm install`
  - `npm run dev`

### Option B — Separate DEV backend deployment
Deploy a second backend service (Render/VPS/etc) with:
- `MONGO_URI` pointing to **DEV DB**
- a distinct origin, e.g. `https://dev-api.newspulse.co.in`

## 3) Point Local Admin at the DEV backend
This repo is already configured so **local admin uses the Vite proxy**:
- Vite proxies `/admin-api/*` and `/api/*` → `http://localhost:5000`
- Local `.env.local` keeps the browser base empty:
  - `VITE_ADMIN_API_BASE=`
  - `VITE_API_URL=`

Result: `http://localhost:5173` can only read/write to whatever is running on `http://localhost:5000`.

## 4) Point Production Admin at the PROD backend
On Vercel (admin project env vars):
- `ADMIN_BACKEND_URL=https://<PROD_BACKEND_ORIGIN>` (serverless proxy target)
- `VITE_ADMIN_API_BASE=https://<PROD_BACKEND_ORIGIN>` (only if you intentionally run direct mode)

## 5) Point Local Public Site at the DEV backend
In the public site repo (or wherever `localhost:3000` is served from), set its API base to the DEV backend.

Typical patterns:
- Next.js: `NEXT_PUBLIC_API_BASE=http://localhost:5000` (or your dev backend origin)
- Vite/React: `VITE_API_URL=http://localhost:5000` (or keep empty + proxy)

Then verify that the public site reads settings from the DEV backend/DB.

## 6) Point Production Public Site at the PROD backend
For the production public site deployment, configure its API base to the PROD backend origin.

## Validation checklist
- Local admin updates “Public Site Settings” and only `localhost:3000` changes.
- Production admin updates “Public Site Settings” and only `www.newspulse.co.in` changes.
- `GET /api/system/health` on DEV and PROD show different DB/cluster identifiers (add a non-sensitive marker if needed).
