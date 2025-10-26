# NewsPulse Admin Panel (Subdomain on Vercel)

This project is ready to deploy at a dedicated subdomain (e.g. `admin.newspulse.co.in`) on Vercel with a secure backend proxy and passwordless (magic link) access.

## What this adds

- Serverless proxy at `/admin-api/*` → forwards to your trusted backend `ADMIN_BACKEND_URL`.
- Proxy enforces an admin session cookie (`np_admin`) signed with `ADMIN_JWT_SECRET`.
- Magic-link endpoints under `/api/admin-auth/*` to issue and verify one-time links.
- Minimal auth UI available at `/auth` to request a magic link (demo mode shows the link).
- SPA fallback remains intact; API routes are preserved.

## Required environment variables (Vercel Project → Settings → Environment Variables)

- `ADMIN_BACKEND_URL` — full URL of your backend (e.g. `https://api.newspulse.co.in`)
- `ADMIN_JWT_SECRET` — long random secret for signing JWTs
- `ADMIN_ALLOWED_EMAILS` — comma-separated list of allowed admin emails (e.g. `founder@newspulse.co.in,admin@newspulse.co.in`)
- `ADMIN_SITE_ORIGIN` — optional; set to `https://admin.newspulse.co.in` to force link origin

## How it works

- Frontend uses `/admin-api` in production (see `src/lib/api.ts`) so all data calls go through the proxy.
- The proxy (`api/admin-proxy/[...path].ts`) validates the `np_admin` cookie and forwards requests to `${ADMIN_BACKEND_URL}/api/*`.
- Magic link flow:
  1. POST `/api/admin-auth/start` with your email
  2. In this demo, the endpoint returns a `link` instead of sending an email
  3. Open the link -> `/api/admin-auth/verify?token=...` sets the `np_admin` cookie and redirects to `/`

## Local development

- Dev stays unchanged: Vite uses `/api` which you proxy to your local backend via `vite.config.ts`.
- Production on Vercel switches base to `/admin-api` automatically.

## Notes

- For production, connect `/api/admin-auth/start` to your mail provider (SendGrid, Resend, SES) to email the magic link instead of returning it.
- If your backend also requires auth headers, add them in `api/admin-proxy/[...path].ts` before forwarding.
