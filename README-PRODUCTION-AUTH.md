# Production Admin Auth & Founder Seeding Guide

This guide covers end-to-end steps to make the admin panel login work in production (Vercel) using the backend deployed elsewhere (e.g. Render/Railway). It assumes the frontend uses the serverless proxy at `/admin-api/*`.

---
## 1. Identify Your Backend URL
You need the real deployed backend base URL (examples):
- Render: `https://your-service.onrender.com`
- Railway: `https://your-app.up.railway.app`
- Other VPS: `https://api.yourdomain.com`

It must respond at: `GET https://<backend-host>/api/health` with a JSON status.

### Quick test (Windows PowerShell)
```powershell
# If you know the backend host already
Invoke-WebRequest -Uri "https://your-service.onrender.com/api/health" -UseBasicParsing | Select-Object -ExpandProperty Content
```

If `Content` shows a JSON object with status OK, proceed.

---
## 2. Set Required Vercel Environment Variables
In Vercel Project Settings → Environment Variables (Production):

| Variable | Value | Notes |
|----------|-------|-------|
| `ADMIN_BACKEND_URL` | `https://<backend-host>` | NO trailing slash |
| `JWT_SECRET` or `ADMIN_JWT_SECRET` | Same secret as backend | Must match for token verification |
| Any SMTP vars | Same as backend (optional) | Needed for password reset emails |

Redeploy after changes so the serverless proxy picks them up.

---
## 3. Validate Proxy Self-Test
After deploy:
```powershell
Invoke-WebRequest -Uri "https://<your-vercel-domain>/api/system/proxy-selftest" -UseBasicParsing | Select-Object -ExpandProperty Content
```
Check fields:
- `env.ADMIN_BACKEND_URL` populated
- `backendHealth.ok` true
- `recursionDetected` false

---
## 4. Seed Founder User (Production)
Use the proxy route (frontend domain) so JWT validation logic matches production:

### PowerShell (Invoke-WebRequest)
```powershell
$body = @{ email = "newspulse.team@gmail.com"; password = "News@123"; force = $true } | ConvertTo-Json
Invoke-WebRequest -Uri "https://<your-vercel-domain>/admin-api/admin/seed-founder" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing | Select-Object -ExpandProperty Content
```

### Alternative: Native curl.exe syntax (if installed)
```powershell
$body = '{"email":"newspulse.team@gmail.com","password":"News@123","force":true}'
curl.exe -X POST "https://<your-vercel-domain>/admin-api/admin/seed-founder" -H "content-type: application/json" -d $body
```

If success, response should indicate user created or updated.

---
## 5. Test Login
Open: `https://<your-vercel-domain>/` (admin panel)
- Enter founder email/password.
- Check network tab: `POST /admin-api/admin/login` returns token.
- Verify a protected request (e.g. `GET /admin-api/admin/me`).

---
## 6. Common Pitfalls
| Issue | Cause | Fix |
|-------|-------|-----|
| 405 / Invalid credentials | Founder not seeded | Run seed-founder route |
| 502 from proxy | Backend unreachable | Fix `ADMIN_BACKEND_URL` or backend deployment |
| Token rejected | Secret mismatch | Align `JWT_SECRET` between backend & Vercel |
| DNS NXDOMAIN | Placeholder domain used | Replace with real Vercel domain |

---
## 7. Optional Direct Mode
If backend has stable CORS and you want to skip the (currently failing) Vercel proxy functions, run in direct mode.

### Direct Mode Setup (Recommended while proxy functions are inactive)
1. Admin backend host (Render service exposing `/api/admin/*`): `https://newspulse-backend-real.onrender.com`
2. In Vercel Project → Environment Variables (Production):
	- `VITE_API_URL=https://newspulse-backend-real.onrender.com/api`  ← single source of truth
	- `ADMIN_BACKEND_URL=https://newspulse-backend-real.onrender.com` (optional legacy usage)
	- `ADMIN_JWT_SECRET` (or `JWT_SECRET`) – must equal backend secret
	- `VITE_DEMO_MODE=false`
3. Backend CORS must allow:
	- `http://localhost:5173`, `http://localhost:3000`
	- `https://admin.newspulse.co.in`
	- Preview domains matching `newspulse-admin-panel-real-*.vercel.app`
4. Redeploy frontend.
5. Network login flow should POST directly to:
	- `https://newspulse-backend-real.onrender.com/api/admin/login`

### Seed Founder in Direct Mode
Run this once (PowerShell):
```powershell
$body = '{"email":"newspulse.team@gmail.com","password":"News@123","force":true}'
curl.exe -X POST "https://newspulse-backend-real.onrender.com/api/admin/seed-founder" -H "content-type: application/json" -d $body
```
Expected JSON: `{ "success": true, "message": "Founder created" }` or `Founder password reset`.

### Verify Login
After seeding, use the UI. Successful login returns token; check Local Storage for `adminToken` and Network for 200 response.
If you still see 404 HTML, confirm you are NOT hitting the general backend `newspulse-backend-real` (it lacks `/api/admin/*`).

### When Proxy Functions Start Working Again
Remove `VITE_API_URL` (or set it blank) to fall back to `/admin-api` proxy, ensuring serverless path security features are used. Keep CORS list updated.

---
## 8. Re-Seeding
Use `force = true` to reset password safely if founder already exists. Avoid changing email to maintain consistency.

---
## 9. Troubleshooting Commands
```powershell
# View raw health
Invoke-WebRequest -Uri "https://<backend-host>/api/health" -UseBasicParsing | Select-Object -ExpandProperty Content

# Inspect headers from proxy seed endpoint
$response = Invoke-WebRequest -Uri "https://<your-vercel-domain>/admin-api/admin/seed-founder" -Method POST -Body $body -ContentType "application/json"
$response.Headers
$response.Content
```

---
## 10. Security Notes
- Never commit secrets; use Vercel env UI.
- Rotate `JWT_SECRET` if compromised (requires redeploy + token invalidation strategy).
- Use a strong founder password and enable password reset via OTP flow.

---
## 11. Operational Safeguards (Publishing & Workflow)

Recent platform hardening added layered controls to prevent accidental or unauthorized publishing:

### 11.1 Global Publish Flag
Environment-driven default (`PUBLISH_ENABLED`) can be runtime overridden (founder only) via UI toggle. When OFF:
- All publish & schedule actions are visually disabled.
- Guard logic blocks backend transition requests (`publish`, `schedule`).

### 11.2 Guard Logic (`guardAction`)
Applies in `ManageNews` and `EditNews` pages before hitting transition endpoint:
- Blocks publish/schedule if global flag OFF.
- Requires founder role for publish when enabled.
- Requires checklist completion for publish/schedule.
- Enforces valid stage (schedule only from `approved`; publish only from `approved` or `scheduled`).
Blocked attempts emit `debug()` logs for auditing.

### 11.3 Bulk Upload Safety
CSV preflight parses statuses client-side; unsafe `published` / `scheduled` rows are downgraded to `draft` if flag OFF or user not founder. Sanitization summary is shown to the user.

### 11.4 Centralized Types
Workflow, submission, and article domain models are defined in `src/types/api.ts` ensuring consistent status/stage usage and reducing drift.

### 11.5 Error & Debug Utilities
`normalizeError()` unifies API error parsing; `debug()` gated by env/localStorage avoids noisy logs in production while retaining deep diagnostics when needed.

### 11.6 Recommended Monitoring Additions
- Track rate of blocked publish actions (founder oversight metric).
- Alert if blocked actions spike (could indicate misuse or misconfigured flag).
- Log CSV sanitization counts to detect patterns of attempted auto-publish.

## 12. Next Steps
- Add monitoring for `/api/health` uptime.
- Enable rate limiting on admin auth endpoints in backend.
- Add MFA layer if required.
- Document flag override audit trail (simple append-only log).
- Add unit tests for transition guards (already partially covered for workflow & bulk upload).

---
Maintained by: NewsPulse Platform Team
