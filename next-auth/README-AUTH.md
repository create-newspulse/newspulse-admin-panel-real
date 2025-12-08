# NewsPulse Auth Portal

Production-grade authentication for the NewsPulse admin ecosystem built with Next.js 14 App Router, Prisma (Mongo), WebAuthn Passkeys, TOTP, Recovery Codes, and Redis-backed rate limiting.

## Features

* Role lanes (Owner vs Team) with guarded `/owner` and `/console` routes via middleware.
* MFA hierarchy: Passkey (preferred) -> TOTP -> Recovery Code fallback.
* JWT Access & Refresh httpOnly Secure Strict cookies.
* Short-lived MFA ticket cookie during challenge flow.
* WebAuthn registration & assertion using `@simplewebauthn/*` with challenge storage in Redis or in-memory fallback.
* TOTP setup & verify with `otplib`.
* One-time recovery code generation (argon2id hashed, never stored plaintext). Consumption verifies & deletes code.
* Redis rate limiting for login, passkey, TOTP, recovery endpoints (fallback in-memory if `REDIS_URL` absent).
* Audit logging for LOGIN, LOGOUT, PASSKEY_REGISTER, MFA_SETUP, MFA_VERIFY.

## Environment Variables (`.env` / `.env.local`)

| Variable | Purpose |
|----------|---------|
| APP_URL | Absolute origin for WebAuthn | 
| AUTH_COOKIE_DOMAIN | Domain for Secure cookies (RP ID) |
| JWT_ACCESS_SECRET / JWT_REFRESH_SECRET | 64+ random bytes each |
| ACCESS_TOKEN_TTL_MIN / REFRESH_TOKEN_TTL_DAYS | Expiries |
| DATABASE_URL | Mongo connection string |
| REDIS_URL | Redis connection for rate limit & challenge store |
| RL_WINDOW_MS / RL_MAX | Rate limit window & max requests |
| FOUNDER_EMAIL / FOUNDER_PASSWORD | Seed founder credentials |
| WEBAUTHN_RP_ID / WEBAUTHN_RP_NAME / WEBAUTHN_ORIGIN | Passkey config (override autodetected) |

## Setup

```powershell
# Install deps
cd next-auth
npm install

# Generate Prisma client
npm run prisma:generate

# Seed founder
npm run db:seed

# Dev server
npm run dev
```

Visit `http://localhost:3000/auth`.

## Login Flows

### Owner
1. Enter founder email/password (lane=owner).
2. If MFA not set: register a passkey or setup TOTP.
3. If MFA enabled: server returns `mfaRequired` with type (`passkey` or `totp`).
4. Complete passkey assertion or TOTP verify → session cookies → redirect `/owner`.
5. Optional recovery code consumption if primary factors unavailable.

### Team
1. Enter email/password (lane=team).
2. Redirect `/console` if authentication succeeds.

## Recovery Codes
* Generated in `/owner` dashboard via "Generate new".
* Displayed once; hashed with argon2id in DB.
* Consumption removes used hash.

## Rate Limiting
Implemented with Redis scriptless counters keyed by `rl:<route>:<window>` or fallback in-memory buckets. Adjust `RL_WINDOW_MS` and `RL_MAX`.

## Security Hardening Checklist
* Rotate JWT secrets quarterly.
* Enforce TLS; set `Secure` cookies only in prod.
* Add CAPTCHA on repeated login failures (placeholder).
* Add email notification for new passkey registration.
* Move in-memory MFA ticket to encrypted Redis entry for horizontal scaling.

## Future Enhancements
* Session revocation & device management.
* Password reset + magic link upgrade path.
* Owner impersonation audit trail with dual authorization.
* Centralized Redis cluster for rate limit + challenge + session store.

## Troubleshooting
| Issue | Fix |
|-------|-----|
| 429 Too many attempts | Lower attempt frequency or raise RL_MAX. |
| Passkey verify fails | Ensure APP_URL & AUTH_COOKIE_DOMAIN match origin; clear challenge and retry. |
| Recovery code invalid | Ensure not previously consumed; generate new set. |
| Prisma errors | Regenerate with `npm run prisma:generate` after schema changes. |

---
Maintained by NewsPulse Security Engineering.