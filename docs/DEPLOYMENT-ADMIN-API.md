# NewsPulse Admin Panel Deployment (Admin API)

This document describes how the admin frontend should reach the backend API in production and local development.

## Recommended: Proxy Mode (Vercel + local)

- Frontend calls relative paths under `/admin-api/*`.
- Vercel serverless proxy forwards `/admin-api/*` → `${ADMIN_BACKEND_URL}/api/*`.

Required (Vercel runtime env):
```
ADMIN_BACKEND_URL=https://your-backend-host.tld
ADMIN_JWT_SECRET=replace_with_long_random_secret
```

Local development:
- Set `ADMIN_BACKEND_URL` in your shell or `.env.local` (no trailing slash).
- Run Vite; it proxies `/admin-api/*` to that target.

## Optional: Direct Mode

If you want the frontend to call the backend origin directly (you must handle CORS on the backend), set a build-time env var like:

```
VITE_API_URL=https://your-backend-host.tld
```

## Endpoint Paths

Backend endpoints are mounted under `/api/*`.

Examples (path only):
- `GET /api/system/health`
- `GET /api/articles?page=1&limit=10`
- `POST /api/admin/login`

## Verification

1. Check proxy health: `GET /admin-api/system/health`.
2. Load the admin UI and confirm requests are going to `/admin-api/*` (proxy mode) or directly to your backend origin (direct mode).
