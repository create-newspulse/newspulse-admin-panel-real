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
  - Proxy (recommended): leave `VITE_API_URL` unset. Frontend calls `/admin-api/*` which the serverless proxy forwards to your backend.
  - Direct: set `VITE_API_URL` = https://your-backend-host.tld and (if sockets) `VITE_API_WS` = wss://your-backend-host.tld.

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

## Local development

- Dev stays unchanged: Vite uses `/api` which you proxy to your local backend via `vite.config.ts`.
- Production on Vercel switches base to `/admin-api` automatically.

## Deploying the backend on Render (blueprint)

This repo includes a `render.yaml` to deploy the backend (`admin-backend/`) and a cron-based health alarm.

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
