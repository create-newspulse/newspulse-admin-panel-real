# NewsPulse Admin Panel – AI Coding Agent Guide

Goal: Make rapid, safe changes across the Vite React admin frontend, Vercel serverless proxy functions, and legacy/backend integration without re‑inventing architecture.

## 1. High‑Level Architecture
- Frontend: React + TS (Vite) under `newspulse-admin-panel-real-main/` (SPA served from `dist`).
- Backend: Real production Express service lives OUTSIDE this repo (Render). In‑repo `admin-backend/` is legacy/demo only; do NOT extend for production.
- Proxy Layer: Vercel serverless function `api/admin-proxy/[...path].js` rewrites `/admin-api/*` → `${ADMIN_BACKEND_URL}/api/*`, adds soft JWT verification + recursion guard.
- Auth Modes: Magic‑link flow via `/api/admin-auth/*` (sets `np_admin` cookie). Demo/Bypass logic controlled by `VITE_DEMO_MODE` and founder auto‑seed endpoints.
- News Management: UI at `/admin/manage-news` drives CRUD against backend `/api/articles*` endpoints (see README for mapping).

## 2. Environment & Modes
- Proxy Mode (preferred): Omit `VITE_API_URL` and use `/admin-api/*`. Requires `ADMIN_BACKEND_URL` (no trailing slash) + optional `ADMIN_JWT_SECRET`.
- Direct Mode (fallback): Set one of `VITE_API_URL` or `VITE_ADMIN_API_BASE_URL`; frontend talks straight to backend (ensure CORS).
- Demo vs Secure: `VITE_DEMO_MODE=true` enables founder auto access; set `false` to require real auth. Never hardcode demo bypass outside env checks.

## 3. Adding / Updating API Calls
- Proxy Mode fetch pattern:
  ```ts
  fetch(`/admin-api/articles?status=published`)
  ```
- Direct Mode fetch pattern:
  ```ts
  const base = import.meta.env.VITE_API_URL; // ends with /api optionally
  fetch(`${base.replace(/\/api$/, '')}/api/articles?status=published`);
  ```
- Avoid double `/api/api`; proxy code already prepends `api/` if missing.
- For new protected routes: return 401 from backend if token invalid; proxy passes through unless soft mode.

## 4. Auth & Session Patterns
- Magic Link Start: `POST /api/admin-auth/start { email }` (demo returns link).
- Verify: Visiting link hits `/api/admin-auth/verify?token=...` sets `np_admin` cookie.
- Founder Seed (PowerShell example):
  ```powershell
  $b = '{"email":"founder@domain","password":"Strong!Pass2025","force":true}'
  Invoke-WebRequest -Uri "https://<vercel>/admin-api/admin/seed-founder" -Method POST -Body $b -ContentType "application/json"
  ```
- In secure mode prefer JWT in cookie (`np_admin`). Bearer tokens accepted; proxy soft‑verifies when secret present.

## 5. Conventions & Gotchas
- Never mutate `admin-backend/secure-server.js` for production features—treat as reference.
- Recursion Guard: If `ADMIN_BACKEND_URL` accidentally points to the Vercel host you’ll get 500 (proxy detects). Fix env, not code.
- Avoid leaking secrets: place new credentials ONLY in env vars; never commit JSON key files (see `CLEANUP_RUNBOOK.md`).
- File placement: Frontend client helpers under `src/lib/`; shared UI components under `components/`; do not introduce Redux—prefer existing context patterns.
- Slug logic & article forms: follow existing drawer form pattern; optimistic UI updates then reconcile counts via `/api/articles/meta`.

## 6. Deployment Workflow (Frontend)
1. Add/adjust env vars in Vercel (Preview + Production).
2. `npm run build` produces `dist/` (auto by Vercel using `vercel.json`).
3. Verify health via `/admin-api/system/health` or `/api/system/proxy-selftest` (checks backend reachability + recursion).

## 7. Rendering / Backend Blueprint
- `render.yaml` & cron script trigger health checks; if adding monitor endpoints keep them beneath `/api/system/*` for consistency.

## 8. Security & Quality Controls
- Pre‑commit secret scanning: PowerShell hook (`HOOKS.md`). If adding generated files, allowlist only via `.secret-scan-allowlist` when unavoidable.
- Soft fallback logic for AI ask routes inside proxy (`kiranos/ask`); preserve it when refactoring fetch/stream code.
- When adding serverless functions: co-locate under `api/` and keep responses JSON (no HTML fallback) to avoid SPA interference.

## 9. Testing & Validation
- Local Dev: Use `start-servers.ps1` for demo backend + frontend; confirm port 5173 and 3002.
- Health: `GET /admin-api/system/health` (proxy path) vs direct `GET <backend>/api/system/health`.
- Articles: Use `requests/articles.http` examples as baseline; extend with new query params (backend must implement filtering).

## 10. Extending Functionality Safely
- Reuse proxy for new secure admin endpoints; add backend path under `/api/admin/*`—no extra rewrite config needed.
- For new environment flags: prefix with `VITE_` (frontend build-time) or plain (serverless runtime). Document them here & in `README-DEPLOY.md`.
- Prefer incremental changes: small PRs; do NOT bundle architectural shifts with feature additions.

## 11. Common Mistakes to Avoid
- Adding trailing slash to `ADMIN_BACKEND_URL` (proxy strips but avoid churn).
- Mixing direct + proxy calls in same module (pick one per module for clarity).
- Committing secret JSON (rotate + follow `CLEANUP_RUNBOOK.md` if it happens).
- Double prefixing `api/` when constructing URLs manually.

## 12. Quick Reference
- Core Proxy: `api/admin-proxy/[...path].js`
- News Feature UI: `src/...` (search `manage-news` for entry components)
- Env Samples: `.env.example`, `.env.local.example`
- Security Scripts: `scripts/test-hook.ps1`, `.git/hooks/pre-commit.ps1`
- Deploy Docs: `README-DEPLOY.md`, `README-PRODUCTION-AUTH.md`

---
If any section is unclear (e.g., adding new article filters, extending auth), ask for clarification and I will refine.
