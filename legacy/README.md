This `legacy` folder stores older, experimental Next.js pages that are not used by the current Vite-powered Admin Panel.

Why is this here?
- Vercel auto-detected Next.js due to the top-level `pages/` folder and printed a noisy warning during builds.
- Moving those files here prevents the detection and keeps the project clean while preserving the old code for reference.

Safe to remove later if not needed.
