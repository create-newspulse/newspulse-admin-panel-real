# NewsPulse Admin Panel Deployment (Unified API Configuration)

This document describes the current (simplified) way the admin frontend resolves its backend API base, plus recommended production setups.

## Current Resolution Logic
The file `lib/api.ts` computes:

```
API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/,'')
API_BASE   = `${API_ORIGIN}/api`
```

Notes:
* We no longer support or read `VITE_ADMIN_API_BASE_URL`, `VITE_API_ROOT`, or any `API_BASE_PATH` constant.
* A relative `/admin-api` pattern was deprecated in favor of explicit absolute origin via `VITE_API_URL`.
* All runtime code imports only the shared axios client (`api`) and optionally calls `setAuthToken(token)`; components derive endpoint paths from `API_BASE` when needed.

## Recommended Production Setup (Direct)
Set an absolute backend origin (example Render URL):
```
VITE_API_URL=https://newspulse-backend-real.onrender.com
```
Requests resolve to:
```
GET https://newspulse-backend-real.onrender.com/api/dashboard-stats
GET https://newspulse-backend-real.onrender.com/api/system/ai-training-info
POST https://newspulse-backend-real.onrender.com/api/admin/login
```

## Optional Legacy Proxy (Deprecated)
If you still have historical Vercel rewrites using `/admin-api`, you may keep them, but the frontend no longer relies on a relative root. Prefer setting `VITE_API_URL` explicitly.

## Local Development
Default origin when `VITE_API_URL` is unset:
```
http://localhost:5000
```
Ensure backend listens on that port or set `VITE_API_URL` to match your local server.

## Removed Fallback Logic
Previous retry behavior (`ADMIN_BACKEND_FALLBACK`) was eliminated. All requests now go directly to `API_BASE`. Failures surface immediately for clearer debugging.

## Auth Endpoints
Mounted on the backend at `/api/admin` and `/api/admin-auth`:
```
POST {API_BASE}/admin/login
POST {API_BASE}/admin/seed-founder
GET  {API_BASE}/admin-auth/session   # magic-link / cookie session check
POST {API_BASE}/admin-auth/logout
```

## Required Environment Variables (Examples)
Minimal Production:
```
NODE_ENV=production
VITE_DEMO_MODE=false
VITE_API_URL=https://newspulse-backend-real.onrender.com
# (OPTIONAL) VITE_API_WS=wss://...  for websockets if needed
```

## Do NOT Use Localhost in Production
All hard-coded `http://localhost:5000` references for critical dashboard + auth flows are centralized; legacy pages may still show localhost in comments but are not used on Vercel.

## Verification Steps After Deploy
1. Open DevTools → Network.
2. Load dashboard – confirm 200 responses for:
   - `GET ${API_BASE}/dashboard-stats`
   - `GET ${API_BASE}/system/ai-training-info`
3. Login: `POST ${API_BASE}/admin/login` returns 200 JSON with token.
4. Logout: `POST ${API_BASE}/admin-auth/logout` returns 200.
5. (Optional) Session check: `GET ${API_BASE}/admin-auth/session` returns current user context.

## Troubleshooting
| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| 404 HTML "Cannot GET /api/..." | Custom domain points to wrong Vercel project | Reassign domain to project with rewrites |
| 404 JSON { success:false } | Backend route not mounted or wrong path | Confirm backend mounts `/api/dashboard-stats` etc. |
| CORS error | Backend `ALLOWED_ORIGINS` missing production domain | Add domain & redeploy backend |
| Login loops to /admin/login | 401 due to founder not seeded | Run seed-founder via `/admin-api/admin/seed-founder` |

## Summary
The admin panel now uses a single environment-driven origin (`VITE_API_URL`) and derives `API_BASE = <origin>/api`. Legacy constants (`API_BASE_PATH`, multiple root env vars, fallback host logic) were removed for consistency and reduced complexity.
