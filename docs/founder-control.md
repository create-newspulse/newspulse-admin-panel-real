# Founder Control

A strictly founder-only area with an executive dark look. Route: `/admin/founder`.

- Guard: `FounderRoute` ensures only `role === 'founder'` may access.
- Live Status Bar polls `/api/system/summary` every 15s.
- Tabs: Identity & Access, AI System Control, Website Master Controls, Legal & Ownership, Monetization, Founder Tools & Analytics, Security & Emergency, AI Logs.

## Environment

Copy `.env.local.example` to `.env.local` and adjust:

- VITE_USE_MOCK=true (use mock APIs locally)
- FOUNDER_EMAIL, EMERGENCY_CODE, REACTIVATION_PHRASE, BACKUP_BUCKET, etc.

## APIs

All endpoints are under `/api/founder/*` and enforce founder-only access via `requireFounder`.
For local dev, `VITE_USE_MOCK=true` lets you use client-side mocks in `src/lib/mockFounderApi.ts`.

Security notes:
- All state-changing routes should include CSRF protection and throttling in real backend.
- Emergency actions are logged (see console `FOUNDER_AUDIT` entries in stub).

## Styling

Tailwind tokens added in `tailwind.config.js` under `executive` for colors and `pulseGlow` animation for buttons.

## Next steps

- Replace stubs with real backend implementations, wire CSRF and rate limiting.
- Add unit tests for `FounderRoute` and API flows.
- Enhance components with real data and flows (downloads, file uploads, etc.).