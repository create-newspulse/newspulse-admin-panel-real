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
Invoke-WebRequest -Uri "https://<your-vercel-domain>/admin-api/admin/auth/seed-founder" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing | Select-Object -ExpandProperty Content
```

### Alternative: Native curl.exe syntax (if installed)
```powershell
$body = '{"email":"newspulse.team@gmail.com","password":"News@123","force":true}'
curl.exe -X POST "https://<your-vercel-domain>/admin-api/admin/auth/seed-founder" -H "content-type: application/json" -d $body
```

If success, response should indicate user created or updated.

---
## 5. Test Login
Open: `https://<your-vercel-domain>/` (admin panel)
- Enter founder email/password.
- Check network tab: `POST /admin-api/admin/auth/login` returns token.
- Verify a protected request (e.g. `GET /admin-api/admin/auth/me`).

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
If backend has stable CORS and you want to skip proxy, set `VITE_API_URL` in Vercel environment to `https://<backend-host>/api` and rebuild. Ensure CORS allows frontend origin.

---
## 8. Re-Seeding
Use `force = true` to reset password safely if founder already exists. Avoid changing email to maintain consistency.

---
## 9. Troubleshooting Commands
```powershell
# View raw health
Invoke-WebRequest -Uri "https://<backend-host>/api/health" -UseBasicParsing | Select-Object -ExpandProperty Content

# Inspect headers from proxy seed endpoint
$response = Invoke-WebRequest -Uri "https://<your-vercel-domain>/admin-api/admin/auth/seed-founder" -Method POST -Body $body -ContentType "application/json"
$response.Headers
$response.Content
```

---
## 10. Security Notes
- Never commit secrets; use Vercel env UI.
- Rotate `JWT_SECRET` if compromised (requires redeploy + token invalidation strategy).
- Use a strong founder password and enable password reset via OTP flow.

---
## 11. Next Steps
- Add monitoring for `/api/health` uptime.
- Enable rate limiting on admin auth endpoints in backend.
- Add MFA layer if required.

---
Maintained by: NewsPulse Platform Team
