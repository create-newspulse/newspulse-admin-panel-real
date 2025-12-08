# Backend CORS Configuration (Admin Panel Production)

To make the Vercel-deployed Admin Panel work against the Admin Backend service, configure CORS on the backend Express app EXACTLY as below.

## Required Allowed Origins
Include all of these (adjust preview domain pattern to your actual project slug):

```
http://localhost:3000
http://localhost:5173
https://<your-vercel-preview>.vercel.app        # each preview; or use a regex/pattern
https://admin.newspulse.co.in                   # production custom domain
```

If you want to allow all previews without listing each one manually, use a pattern test (recommended): `/newspulse-admin-panel-real-.*\.vercel\.app$/i`

## Sample Express Configuration
```js
import cors from 'cors';

const STATIC_ALLOWED = new Set([
  'http://localhost:3000',
  'http://localhost:5173',
  'https://admin.newspulse.co.in',
]);

const PREVIEW_PATTERN = /newspulse-admin-panel-real-[a-z0-9-]+\.vercel\.app$/i;

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true); // same-origin or curl
    if (STATIC_ALLOWED.has(origin)) return cb(null, true);
    try {
      const host = origin.replace(/^https?:\/\//, '').split('/')[0];
      if (PREVIEW_PATTERN.test(host)) return cb(null, true);
    } catch {}
    return cb(new Error(`CORS blocked origin: ${origin}`));
  },
  credentials: true,
}));
app.options('*', cors());
```

## Notes
- Set `credentials: true` only if you use cookies (session/JWT cookie). If you store JWT in localStorage and send `Authorization` headers only, cookies are not required.
- Keep origins explicit—avoid `*` with credentials.
- If using Socket.IO, mirror the same origin logic there.

## Environment Variables Approach
Instead of hardcoding, you can drive this list via an env var:

```js
const EXTRA = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
EXTRA.forEach(o => STATIC_ALLOWED.add(o));
```
Then on Render set:
```
ALLOWED_ORIGINS=https://admin.newspulse.co.in,https://newspulse-admin-panel-real-yourhash.vercel.app
```

## Verification Commands (PowerShell)
```powershell
Invoke-WebRequest -Uri "https://<ADMIN_BACKEND_HOST>/api/system/health" -UseBasicParsing | Select-Object -ExpandProperty Content

# From Vercel (after deploy) – should return backend JSON, not HTML
Invoke-WebRequest -Uri "https://admin.newspulse.co.in/api/system/health" -UseBasicParsing | Select-Object -ExpandProperty Content
```

If you see HTML instead of JSON for `/api/system/health` through Vercel, the request is hitting the SPA and not the backend (rewrite misconfiguration).

## Socket.IO Example
```js
const io = new Server(server, {
  path: '/socket.io',
  cors: {
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (STATIC_ALLOWED.has(origin)) return cb(null, true);
      const host = origin.replace(/^https?:\/\//, '').split('/')[0];
      if (PREVIEW_PATTERN.test(host)) return cb(null, true);
      return cb(new Error('Not allowed by Socket.IO CORS'));
    },
    methods: ['GET','POST'],
    credentials: true,
  }
});
```

## Final Checklist
- [ ] Admin backend URL confirmed (Render service `newspulse-admin-backend`) – must serve `/api/admin/login`.
- [ ] `VITE_API_URL` set in Vercel to `https://<ADMIN_BACKEND_HOST>/api`.
- [ ] CORS allows Vercel preview + production custom domain.
- [ ] Login succeeds (POST `/api/admin/login` returns token).
- [ ] Dashboard endpoints (`/api/dashboard-stats`, `/api/system/ai-training-info`, `/api/system/health`) return JSON (no 404 / HTML).
