# NewsPulse Admin Panel Deployment (API Base Configuration)

This document explains exactly how the frontend resolves the Admin API base URL in development and production and what you must configure on Vercel.

## Resolution Order
The file `src/lib/api.ts` chooses the API root in this order (first non-empty wins):
1. `VITE_ADMIN_API_BASE_URL`  (canonical – preferred; root WITHOUT trailing /api)
2. `VITE_API_ROOT`            (legacy modern – root WITHOUT /api)
3. `VITE_API_URL`             (older var – MAY include `/api` at the end; we strip it)
4. Default:
   - Development: `http://localhost:5000`
   - Production: `/admin-api` (relative path served via Vercel rewrites to the Render backend)

After resolving the root we append `/api` unless the root is relative (starts with `/`). So:
* If `API_ROOT = '/admin-api'` then `API_BASE_PATH = '/admin-api'` (no extra `/api`).
* If `API_ROOT = 'https://newspulse-backend-real.onrender.com'` then `API_BASE_PATH = 'https://newspulse-backend-real.onrender.com/api'`.

## Recommended Production Setup (Proxy Mode)
Keep the existing Vercel rewrites:
```jsonc
// vercel.json
{
  "rewrites": [
    { "source": "/admin-api/:path*", "destination": "https://newspulse-backend-real.onrender.com/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```
Then DO NOT set any of the env vars above – the default production root becomes `/admin-api` and every request like:
```
GET /admin-api/dashboard-stats
GET /admin-api/system/ai-training-info
POST /admin-api/admin/login
```
is automatically rewritten to the Render backend.

## Recommended Production Setup (Direct Mode)
If you prefer to bypass rewrites (or need temporary direct calls), set:
```
VITE_ADMIN_API_BASE_URL=https://newspulse-backend-real.onrender.com
```
Remove or keep rewrites (they are ignored by the direct absolute host). Requests will resolve to:
```
GET https://newspulse-backend-real.onrender.com/api/dashboard-stats
GET https://newspulse-backend-real.onrender.com/api/system/ai-training-info
POST https://newspulse-backend-real.onrender.com/api/admin/login
```

## Fallback Host Logic
If the proxy (`/admin-api/...`) returns a 404/405 or HTML (misconfigured domain), the client retries selected GET endpoints against:
```
ADMIN_BACKEND_FALLBACK = https://newspulse-backend-real.onrender.com/api
```
Exported from `src/lib/api.ts` and reused by `fetchJson` and `AuthContext`.

## Auth Endpoints
Mounted on the backend at `/api/admin` (and legacy `/api/admin/auth`). The frontend calls:
```
POST {API_BASE_PATH}/admin/login
POST {API_BASE_PATH}/admin/seed-founder
GET  {API_BASE_PATH}/admin-auth/session   (magic-link / cookie session check)
POST {API_BASE_PATH}/admin-auth/logout
```

## Required Environment Variables (Examples)
Proxy Mode (recommended – simplest):
```
NODE_ENV=production
VITE_DEMO_MODE=false
# (OPTIONAL) JWT_SECRET or ADMIN_JWT_SECRET for backend if used in serverless helpers
```

Direct Mode:
```
NODE_ENV=production
VITE_DEMO_MODE=false
VITE_ADMIN_API_BASE_URL=https://newspulse-backend-real.onrender.com
```

## Do NOT Use Localhost in Production
All hard-coded `http://localhost:5000` references for critical dashboard + auth flows are centralized; legacy pages may still show localhost in comments but are not used on Vercel.

## Verification Steps After Deploy
1. Open DevTools → Network.
2. Load dashboard – confirm 200 responses for:
   - `/admin-api/dashboard-stats` OR `https://newspulse-backend-real.onrender.com/api/dashboard-stats`
   - `/admin-api/system/ai-training-info`
3. Perform login:
   - Check `POST /admin-api/admin/login` returns 200 JSON with token.
4. Logout:
   - `POST /admin-api/admin-auth/logout` returns 200.
5. Refresh page – session cookie (if any) results in a successful `GET /admin-api/admin-auth/session` (optional).

## Troubleshooting
| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| 404 HTML "Cannot GET /api/..." | Custom domain points to wrong Vercel project | Reassign domain to project with rewrites |
| 404 JSON { success:false } | Backend route not mounted or wrong path | Confirm backend mounts `/api/dashboard-stats` etc. |
| CORS error | Backend `ALLOWED_ORIGINS` missing production domain | Add domain & redeploy backend |
| Login loops to /admin/login | 401 due to founder not seeded | Run seed-founder via `/admin-api/admin/seed-founder` |

## Summary
The admin panel now uses a single resolution pipeline for its API base with optional direct mode override and an exported fallback host, eliminating previous inconsistent hard-coded paths.
