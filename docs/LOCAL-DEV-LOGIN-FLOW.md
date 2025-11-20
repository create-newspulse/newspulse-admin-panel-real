# Local Dev Login Flow - Production Parity Guide

## Problem Summary

Local development login was failing with 404 errors while production login worked correctly. This document explains the **root cause**, **solution**, and **verification steps** to ensure local dev behaves exactly like production.

---

## Root Cause Analysis

### Production Flow (Working ✅)

```
1. Frontend → POST /admin-api/admin/login
2. Vercel Rewrite (admin/vercel.json) → /api/admin-proxy/admin/login
3. Serverless Proxy (admin/api/admin-proxy/[...path].js)
   - Receives path: 'admin/login'
   - Transforms to: ${ADMIN_BACKEND_URL}/api/admin/login
   - Forwards request to: https://newspulse-backend-real.onrender.com/api/admin/login
4. Backend Route (render-backend-real/routes/adminAuth.js)
   - Mounted at: /api/admin
   - Endpoint: POST /login
   - Full path: /api/admin/login
   - Returns: {ok: true, token, user}
```

### Previous Local Dev Flow (Broken ❌)

```
1. Frontend → POST https://newspulse-backend-real.onrender.com/api/admin/login
2. Direct call to backend (no proxy)
3. Backend not deployed with /api/admin route → 404
```

**Key Issue:** Local dev was calling backend directly at an endpoint that may not exist, while production uses a proxy that transforms paths.

---

## Solution Implemented

### Strategy: Mimic Production Proxy in Local Dev

Make local Vite dev server behave like production Vercel proxy:
- Frontend calls `/admin-api/*` (same as production)
- Vite proxies and transforms path to backend `/api/*`
- Backend receives identical request as production

### Files Modified

#### 1. `.env.development` - Use Relative Proxy Path
```env
# Local dev uses /admin-api/* path (same as production Vercel)
# Vite proxy will forward to backend
VITE_ADMIN_API_BASE_URL=/admin-api
VITE_API_URL=/admin-api
VITE_API_BASE=
VITE_API_WS=

# Backend target for Vite proxy (not used by frontend directly)
ADMIN_BACKEND_URL=https://newspulse-backend-real.onrender.com
```

**Why:** Frontend now resolves `baseURL = '/admin-api'` instead of absolute backend URL, forcing all requests through Vite proxy.

#### 2. `vite.config.js` - Add Admin Proxy Rule
```javascript
proxy: {
  // Production-like proxy: /admin-api/* -> backend /api/*
  // Mimics Vercel proxy behavior for local dev
  '/admin-api': {
    target: env.ADMIN_BACKEND_URL || 'https://newspulse-backend-real.onrender.com',
    changeOrigin: true,
    secure: false,
    rewrite: (path) => path.replace(/^\/admin-api/, '/api'),
  },
  '/api': {
    target: API_HTTP,
    changeOrigin: true,
    secure: false,
  },
  '/socket.io': {
    target: API_WS,
    ws: true,
    changeOrigin: true,
    secure: false,
  },
}
```

**Why:** 
- Intercepts `/admin-api/*` requests
- Rewrites path: `/admin-api/admin/login` → `/api/admin/login`
- Forwards to backend: `https://newspulse-backend-real.onrender.com/api/admin/login`

#### 3. `src/lib/adminApi.ts` - Handle Relative Paths
```typescript
// Derive origin from shared api client baseURL (no trailing slash)
const ORIGIN = api.defaults.baseURL!.replace(/\/$/, '');

// Special handling for production proxy paths vs direct backend URLs
// If ORIGIN is a relative path like '/admin-api', use it as-is (Vite/Vercel will proxy)
// If ORIGIN is absolute URL, append /api
const isRelative = ORIGIN.startsWith('/');
const API_ROOT = isRelative ? ORIGIN : (ORIGIN.endsWith('/api') ? ORIGIN : `${ORIGIN}/api`);
```

**Why:** 
- When `ORIGIN = '/admin-api'` (relative), `API_ROOT = '/admin-api'`
- `adminRoot.post('/admin/login')` → `/admin-api/admin/login` ✅
- Prevents double `/api` when using proxy paths

---

## Request Flow Comparison

### Production (Vercel)
```
Frontend        Vercel Proxy                Backend
--------        ------------                -------
POST            Rewrite rule:               Routes:
/admin-api/     /admin-api/* →              /api/admin
admin/login     /api/admin-proxy/*          mounted

                Proxy function:
                /api/admin-proxy/admin/login
                → transforms to:
                ${BACKEND}/api/admin/login  ← Receives request
                                              Returns JWT
```

### Local Dev (Vite)
```
Frontend        Vite Proxy                  Backend
--------        ----------                  -------
POST            Proxy rule:                 Routes:
/admin-api/     /admin-api/* →              /api/admin
admin/login     rewrite to /api/*           mounted

                Forwards to:
                ${BACKEND}/api/admin/login  ← Receives request
                                              Returns JWT
```

**Result:** Identical request path reaches backend in both environments!

---

## Verification Steps

### 1. Start Dev Server
```powershell
cd newspulse-admin-panel-real-main
npx vite --port 5173
```

### 2. Check Console Logs
Look for resolved base URL in browser console:
```
[api] baseURL resolved = /admin-api
```

### 3. Test Login Request

**Open:** `http://localhost:5173/admin/login`

**Enter credentials:**
- Email: `newspulse.team@gmail.com`
- Password: `News@123`

**Check Network Tab:**
```
Request URL: http://localhost:5173/admin-api/admin/login
Request Method: POST
Status Code: 200 OK
```

**Check Response:**
```json
{
  "ok": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "founder-001",
    "name": "Founder",
    "email": "newspulse.team@gmail.com",
    "role": "founder"
  }
}
```

### 4. Verify Vite Proxy Logs

Terminal running `npm run dev` should show:
```
[vite] /admin-api/admin/login → https://newspulse-backend-real.onrender.com/api/admin/login
```

### 5. Check Token Storage

Browser DevTools → Application → Local Storage:
```
adminToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Troubleshooting

### Login still returns 404

**Check 1:** Verify Vite proxy is configured
```bash
grep -A 10 "'/admin-api'" vite.config.js
```

**Check 2:** Restart dev server
```powershell
# Kill existing process
$process = Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess
Stop-Process -Id $process -Force

# Restart
npx vite --port 5173
```

**Check 3:** Verify backend route exists
```bash
# Check render-backend-real/server.js
grep "app.use.*admin" render-backend-real/server.js
```

Expected output:
```javascript
app.use('/api/admin', adminAuthRouter);
```

### CORS errors in console

**Symptom:** `Access to XMLHttpRequest blocked by CORS policy`

**Fix:** Backend must allow `http://localhost:5173`

Check `render-backend-real/server.js`:
```javascript
const allowList = [
  'http://localhost:5173',
  'https://admin.newspulse.co.in',
  'https://newspulse.co.in',
];
```

### Token not saved after login

**Check:** `withCredentials` enabled in axios clients

Verify `src/lib/adminApi.ts`:
```typescript
export const adminRoot = axios.create({
  baseURL: ADMIN_ROOT_BASE,
  withCredentials: true,  // ← Must be true
  timeout: 15000,
});
```

### Vite proxy not working

**Symptom:** Requests go directly to backend instead of through proxy

**Check `.env.development`:**
```env
VITE_ADMIN_API_BASE_URL=/admin-api  # ← Must be relative path
```

**NOT:**
```env
VITE_ADMIN_API_BASE_URL=https://newspulse-backend-real.onrender.com  # ❌ Bypasses proxy
```

---

## Environment Comparison Table

| Aspect | Production (Vercel) | Local Dev (Vite) |
|--------|---------------------|------------------|
| **Frontend Base URL** | `/admin-api` | `/admin-api` |
| **Proxy Type** | Vercel serverless function | Vite dev server |
| **Proxy Config** | `admin/vercel.json` routes | `vite.config.js` proxy |
| **Path Transform** | `/admin-api/*` → `${BACKEND}/api/*` | `/admin-api/*` → `${BACKEND}/api/*` |
| **Backend Target** | `ADMIN_BACKEND_URL` env var | `ADMIN_BACKEND_URL` env var |
| **Login Endpoint** | `/admin-api/admin/login` | `/admin-api/admin/login` |
| **Backend Receives** | `/api/admin/login` | `/api/admin/login` |
| **Credentials** | `newspulse.team@gmail.com` | `newspulse.team@gmail.com` |
| **Token Storage** | `localStorage.adminToken` | `localStorage.adminToken` |

---

## Key Takeaways

1. **Production uses serverless proxy** (`admin/api/admin-proxy/[...path].js`) to transform `/admin-api/*` → `${BACKEND}/api/*`

2. **Local dev uses Vite proxy** (`vite.config.js`) to achieve identical transformation

3. **Frontend code is environment-agnostic**:
   - Calls `/admin-api/admin/login` in both production and local
   - Proxy layer handles routing to backend

4. **Backend receives identical requests** in both environments:
   - Path: `/api/admin/login`
   - Method: `POST`
   - Body: `{email, password}`
   - Returns: `{ok, token, user}`

5. **Environment variables control proxy target** (`ADMIN_BACKEND_URL`), not frontend base URL

---

## Related Files

### Frontend
- `src/lib/api.ts` - Central axios client config
- `src/lib/adminApi.ts` - Admin-specific API client
- `src/components/auth/LoginForm.tsx` - Login UI component
- `src/context/AuthContext.tsx` - Authentication context
- `.env.development` - Local dev environment variables

### Proxy Layer
- `vite.config.js` - Vite dev server proxy config (local)
- `admin/vercel.json` - Vercel rewrite rules (production)
- `admin/api/admin-proxy/[...path].js` - Serverless proxy function (production)

### Backend
- `render-backend-real/server.js` - Express app setup, CORS config
- `render-backend-real/routes/adminAuth.js` - Auth endpoints
- Deployment: Render at `https://newspulse-backend-real.onrender.com`

---

## Success Criteria

✅ **Local dev login works with same credentials as production**

✅ **Frontend calls same endpoint path (`/admin-api/admin/login`) in both environments**

✅ **Backend receives same request path (`/api/admin/login`) in both environments**

✅ **No 404 or CORS errors in browser console**

✅ **JWT token saved to `localStorage.adminToken`**

✅ **Dashboard loads after successful login**
