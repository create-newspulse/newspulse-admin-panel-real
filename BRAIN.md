# News Pulse Admin Panel - Project Brain

This file contains durable context for coding agents working in the News Pulse Admin Panel repository.

Keep this file small. It is not a changelog, roadmap, implementation snapshot, or task tracker.

## Repository

Repository: `newspulse-admin-panel-real-main`

Application: News Pulse Admin Panel built with React, TypeScript, and Vite.

## Source of Truth

When information conflicts, prefer:

1. Current application code
2. Current automated tests
3. `.github/copilot-instructions.md`
4. Current environment and safety documentation
5. `README.md`
6. Other maintained documentation
7. Historical Git commits

Do not trust an old document merely because it says "complete", "verified", "production", or "ready".

## Authentication

The current Admin Panel uses email/password authentication.

Before modifying authentication, inspect the current implementation, especially:

- `src/context/AuthContext.tsx`
- `src/services/authService.ts`
- `src/components/auth/LoginForm.tsx`
- current authentication/account tests

Do not treat historical magic-link or founder-seeding flows as the primary login architecture.

`VITE_DEMO_MODE` still exists in limited development/founder-route behavior. Do not turn it into a general authentication bypass.

## Founder and Staff Access

Founder and staff authorization is an active part of the Admin Panel.

Use the current access-control implementation, API helpers, settings/team-management pages, and tests as the source of truth.

Do not weaken Founder protections, module permissions, staff access controls, or special-right checks merely to make a screen accessible.

## Backend Integration

The production backend is a separate service/repository.

Do not add production backend business logic to legacy or demo backend code inside this Admin Panel repository unless the current architecture explicitly requires it.

Use the current Admin API helpers and proxy/direct backend configuration already implemented in this repository.

## Development and Production Isolation

Local development must remain isolated from production.

Read:

- `docs/DEV_PROD_BACKEND_DB_SEPARATION.md`

Do not silently point localhost to production databases, authentication services, email delivery, OTP delivery, or other production-only services.

Do not weaken environment-separation safeguards simply to make localhost work.

## Environment Configuration

Never hardcode credentials, backend secrets, API keys, passwords, tokens, or production URLs into application code.

Use the current `.env.example`, environment-specific examples, Vite configuration, API helpers, and tests as the source of truth.

Do not expose the contents of local or production `.env` files in logs, documentation, or commits.

## Security

The repository contains pre-commit and CI secret-scanning protections.

Preserve:

- `.husky/pre-commit`
- `.gitleaks.toml`
- `.secret-scan-allowlist`
- GitHub secret-scan workflows
- `scripts/test-hook.ps1` (legacy/local harness; verify against the current Husky setup before relying on it)

Keep allowlists narrow. Prefer removing or masking secrets instead of bypassing security checks.

## Publishing and Editorial Actions

Publishing, scheduling, article workflow, and related Founder/staff permissions are sensitive operations.

Use the current implementation and tests rather than old transition tables or historical documentation when changing these flows.

Do not weaken server-side or client-side authorization checks.

## Documentation Policy

Keep documentation only when it has a continuing operational, architectural, security, or development purpose.

Prefer current code and automated tests over manually maintained completion reports or implementation snapshots.

Avoid duplicate documents that describe the same architecture and can drift independently.

## Change Safety

Make focused changes and avoid unrelated modifications.

Before commit or deployment:

- inspect the exact diff
- run applicable tests
- run type checks when available
- run the production build when appropriate
- confirm environment files and secrets were not unintentionally changed
- preserve localhost/production separation

Do not treat successful local behavior alone as proof that production is safe.

## Maintaining BRAIN.md

Update this file only when a durable architectural rule, security constraint, authentication model, environment rule, or source-of-truth policy changes.

Do not add:

- temporary bugs
- current task status
- release notes
- one-off fixes
- speculative roadmap items
- detailed implementation snapshots
