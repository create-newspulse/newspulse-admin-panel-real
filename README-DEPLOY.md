Deployment guide - Admin Panel (frontend on Vercel, backend on Render)

This README explains the recommended deployment: frontend hosted on Vercel, backend (Express) hosted on Render (or Railway/Fly). It includes the exact environment variables you must set and quick verification steps.

1) Deploy the backend (Render example)
- Go to https://dashboard.render.com -> New -> Web Service -> Connect to GitHub -> select this repo.
- Choose branch: main
- Build & Start:
  - Build Command: (optional) npm install
  - Start Command: node server.cjs
- Environment variables (set these in Render):
  - PORT (optional): 5000
  - MONGODB_URI: <your mongodb connection string>
  - FIREBASE_CREDENTIALS (or service account JSON as required by your code)
  - Any other secrets (API keys, etc.) used by admin-backend
  - ALLOWED_ORIGINS: https://<your-frontend>.vercel.app,https://your-production-domain.com

- After Render deploys you will get a public backend URL, e.g. https://api-newspulse.onrender.com

2) Configure Vercel (frontend)
- In Vercel Dashboard for this project -> Settings -> Environment Variables, add:
  - VITE_API_BASE = https://api-newspulse.onrender.com
  - VITE_API_WS   = wss://api-newspulse.onrender.com  (if using websockets)
  - VITE_API_URL  = https://api-newspulse.onrender.com/api  (optional)
- Set these for both Preview and Production environments.

3) CORS and credentials
- If your frontend uses cookies/credentials, set ALLOWED_ORIGINS on the backend to include your Vercel origin and ensure backend code echoes Origin and sends Access-Control-Allow-Credentials: true.
- Server code includes support for ALLOWED_ORIGINS env var. Example:
  ALLOWED_ORIGINS=https://your-project.vercel.app,https://www.yourdomain.com

4) Redeploy Vercel
- After adding env vars, trigger a redeploy of the Vercel project (from the dashboard: Deployments -> Redeploy) so Vite rebuilds with new import.meta.env values.

5) Verification
- Open the Vercel site -> DevTools -> Network -> check a failing /api request.
  - Request URL should be https://api-newspulse.onrender.com/api/... or proxied correctly.
  - Response should be JSON (200) not HTML (403/401 or index.html)

7) Build warnings to ignore or silence
- “Failed to fetch one or more git submodules”: This repo has no submodules. In Vercel Project Settings -> Git, turn OFF “Enable Git Submodules” to silence this warning.
- “When using Next.js, place JavaScript Functions inside pages/api”: This project is Vite-based. We keep a legacy copy of old Next.js pages under `legacy/next-pages`, and `.vercelignore` excludes `pages/` and `legacy/`. If you still see this warning, make sure the `.vercelignore` in the root contains:
  
  pages/
  legacy/
  admin-backend/
  newspulse-backend/
  backend/
  
  and trigger a new deploy.

6) Security
- Do not commit secret files (serviceAccountKey.json, .env). If you committed secrets, rotate them and remove them from Git history.
- I can prepare BFG/git-filter-repo commands to scrub secrets from git history on request.

---
If you want, I can:
- Prepare the Render deploy with a sample Render YAML file.
- Add a small `vercel.md` with the exact UI steps and screenshots.
- Run a quick scan for common secrets in the repo and list them.

Next steps: push these two changes and I will redeploy or guide you through setting the envs.
