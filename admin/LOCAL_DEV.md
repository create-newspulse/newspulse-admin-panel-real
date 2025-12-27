# Local Development (Admin UI)

Run the admin frontend on http://localhost:5173 with the same backend as Vercel.

Steps

1) Move into the admin app

   ```powershell
   cd admin
   ```

2) Install dependencies

   ```powershell
   npm install
   ```

3) Ensure local env points to your backend:

   - Edit `admin/.env.local` if needed
   - It should contain:

     ```env
   VITE_ADMIN_API_BASE_URL=https://your-backend-host.tld
     ```

4) Start Vite dev server (strict on port 5173)

   ```powershell
   npm run dev
   ```

5) Open the login page

   - http://localhost:5173/admin/login

Notes

- You do NOT need to start `admin-backend/` for local UI development.
- API routes and paths remain unchanged; this UI calls the same backend origin used in production.
