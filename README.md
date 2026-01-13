# NewsPulse Admin Panel (Subdomain on Vercel)

This project is ready to deploy at a dedicated subdomain (e.g. `admin.newspulse.co.in`) on Vercel with a secure backend proxy and passwordless (magic link) access.

## What this adds

- Serverless proxy at `/admin-api/*` → forwards to your trusted backend `ADMIN_BACKEND_URL`.
- Proxy enforces an admin session cookie (`np_admin`) signed with `ADMIN_JWT_SECRET`.
- Magic-link endpoints under `/api/admin-auth/*` to issue and verify one-time links.
- Minimal auth UI available at `/auth` to request a magic link (demo mode shows the link).
- SPA fallback remains intact; API routes are preserved.

## Vercel deploy checklist

Follow these steps to ship the frontend to Vercel and connect it to your backend.

1) Connect repo
- Vercel Dashboard → New Project → Import this GitHub repo
- Framework detected: Vite (from `vercel.json`)
- Build command: `npm run build`
- Output directory: `dist`
  
2) Set environment variables
- Required:
  - `ADMIN_BACKEND_URL` = https://your-backend-host.tld
- Optional (pick ONE approach):
  - Proxy (recommended): keep `VITE_ADMIN_API_BASE` empty. Frontend calls relative `/admin-api/*` which the serverless proxy forwards to your backend.
  - Direct (no proxy): set `VITE_ADMIN_API_BASE` = https://your-backend-host.tld (no trailing slash) and ensure backend CORS allows your admin origin.

3) Deploy
- Click Deploy. After it’s live, open:
  - `https://<your-vercel>/admin-api/system/health` → should return JSON from your backend.
- Open the app and verify dashboards load without 401/500.

4) Screenshots (placeholders)
- Connect repo: `docs/img/vercel-connect-repo.png`
- Set env vars: `docs/img/vercel-env-vars.png`
- Successful deploy: `docs/img/vercel-deploy-complete.png`

You can drop your own screenshots into the `docs/img/` folder using the file names above; they’ll render automatically here.

## Required environment variables (Vercel Project → Settings → Environment Variables)

- `ADMIN_BACKEND_URL` — full URL of your backend (e.g. `https://api.newspulse.co.in`)
- `ADMIN_JWT_SECRET` — long random secret for signing JWTs
- `ADMIN_ALLOWED_EMAILS` — comma-separated list of allowed admin emails (e.g. `founder@newspulse.co.in,admin@newspulse.co.in`)
- `ADMIN_SITE_ORIGIN` — optional; set to `https://admin.newspulse.co.in` to force link origin

## How it works

- Frontend uses `/admin-api` in production (see `src/lib/api.ts`) so all data calls go through the proxy.
- The proxy (`api/admin-proxy/[...path].js`) forwards requests to `${ADMIN_BACKEND_URL}/api/*` and supports streaming (Edge runtime).
- Magic link flow:
  1. POST `/api/admin-auth/start` with your email
  2. In this demo, the endpoint returns a `link` instead of sending an email
  3. Open the link -> `/api/admin-auth/verify?token=...` sets the `np_admin` cookie and redirects to `/`

## Backend

This repo is designed to behave the same locally and on Vercel:

- In the browser, the frontend calls the proxy base `/admin-api/*`.
- On Vercel, the serverless proxy forwards `/admin-api/*` to `ADMIN_BACKEND_URL`.
- Locally, Vite proxies `/admin-api/*` to your chosen backend target (set via env).

Avoid shipping a hardcoded Render URL in the frontend. Use env vars instead.

## Local Development

1) Install

```
npm install
```

2) Configure

- Preferred (proxy mode; matches Vercel): leave `VITE_ADMIN_API_BASE` empty and run a backend locally.
- Optional (direct mode): set `VITE_ADMIN_API_BASE` to a valid backend origin (no trailing slash).

Recommended dev setup for `/admin-api/*`
- Leave `VITE_ADMIN_API_BASE` empty so browser requests stay relative (e.g. `/admin-api/broadcast`).
- Vite dev server proxies `/admin-api/*` and `/api/*` to your local backend (default `http://localhost:5000`).
- Also keep `VITE_API_URL` empty in dev (some modules still read it); this prevents accidental direct calls to production.

After changing any `.env*` values or Vite proxy config, restart the dev server.

Example `.env.local`:

```
# DEV: keep empty to use Vite proxy -> http://localhost:5000
VITE_ADMIN_API_BASE=

# DEV: keep empty so requests stay relative and use the Vite proxy
VITE_API_URL=

# PROD (Vercel): set to your backend origin (no trailing slash)
# VITE_ADMIN_API_BASE=https://PROD_BACKEND_DOMAIN
```

3) Run

```
npm run dev:full
```

Open: `http://localhost:5173`

### Manage News Module

The admin UI provides a full Manage News panel at `/admin/manage-news` (protected route). An alias is also available at `/manage-news` for convenience. It includes:

- Server-side pagination & filters (search text, status, language, date range)
- Multi-select category filter chips (maps to CSV list in query; backend supports `$in`)
- Inline status / PTI / trust score badges
- Add / Edit (drawer form) with automatic slug generation
- Tags chip input with add/remove
- Archive / Restore / Soft Delete actions with optimistic updates
- CSV bulk upload (drag-n-drop) with result summary (created / updated / skipped / errors)
- Badge counts in navbar (Published / Drafts / Flagged)

Backend endpoints (`/api/articles`):

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | /api/articles | List with filters & pagination |
| GET | /api/articles/meta | Counts for navbar badges |
| GET | /api/articles/:idOrSlug | Fetch single article by ObjectId or slug |
| POST | /api/articles | Create article (editor+) |
| PUT | /api/articles/:id | Update article (editor+) |
| PATCH | /api/articles/:id/archive | Archive (sets status=archived) |
| PATCH | /api/articles/:id/restore | Restore archived to draft |
| DELETE | /api/articles/:id | Soft delete (status=deleted) |
| POST | /api/articles/bulk-upload | CSV bulk import (field `file`) |

CSV template headers:

```
title,summary,content,category,tags,imageUrl,sourceName,sourceUrl,language,status,scheduledAt
```

Sample requests: see `requests/articles.http`.

### Navigation consolidation

- AI Assistant merged into AI Engine — `/admin/ai-assistant` now redirects to `/admin/ai-engine`.
- Founder Control merged into Safe Owner Zone — `/admin/founder-control` and `/admin/founder` redirect to `/safe-owner`.
- Settings merged into Safe Owner Zone — `/admin/settings` redirects to `/safe-owner?tab=settings`.
- Push History integrated under Workflow — `/push-history` redirects to `/admin/workflow?tab=push-history`.
- Panel Guide moved to private docs; route removed.

Safe Owner Zone now supports tabs via the `?tab=` query param: `overview`, `settings`, `ai`, `security`, `analytics`.

## Quick verification checklist

- `/admin/articles` -> list loads
- `/broadcast-center` -> breaking/live lists load; Add + Save work
- `/admin/settings/admin-panel/team` -> staff list loads (or shows the friendly "endpoint missing" state)
- `/safe-owner` -> snapshots/audit/passkey calls no longer 404
Editorial Workflow Engine supports internal tabs via `?tab=`: `queue`, `push-history`, `schedules`, `automation`, `logs`.

## Deploying the backend on Render (blueprint)

This repo previously included a prototype backend; the real backend lives in a separate repo and is deployed on Render.

What you get:
- Web service `newspulse-admin-backend` with `healthCheckPath: /api/system/health`.
- Cron job `newspulse-backend-health-alarm` running every 5 minutes:
  - Pings the backend health endpoint.
  - If it fails, posts to `SLACK_WEBHOOK_URL` (optional).

How to use:
1. In Render → Blueprints → New from Blueprint → select this repo.
2. Set env vars in the Render UI (they are referenced in `render.yaml`). At minimum:
   - `OPENAI_API_KEY`, `MONGO_URI`, `ALLOWED_ORIGINS` (include your Vercel domain), optionally `SERVER_URL`.
   - For the cron: `BACKEND_URL` (public URL Render assigns), optionally `SLACK_WEBHOOK_URL`.
3. Deploy. Once healthy, copy the backend URL into Vercel as `ADMIN_BACKEND_URL`.

Files:
- `render.yaml` — Render blueprint (web + cron)
- `admin-backend/scripts/healthAlarm.js` — Health alarm script (used by cron)

## Notes

- For production, connect `/api/admin-auth/start` to your mail provider (SendGrid, Resend, SES) to email the magic link instead of returning it.
- If your backend also requires auth headers, add them in `api/admin-proxy/[...path].js` before forwarding.
