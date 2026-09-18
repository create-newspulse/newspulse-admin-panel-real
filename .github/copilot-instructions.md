# News Pulse Admin Panel - Coding Agent Instructions

Read `BRAIN.md` before making changes.

## Source of Truth

Use current code and automated tests before historical Markdown documentation.

Do not assume an old "complete", "verified", deployment, migration, or implementation-status document still describes the application.

## Application

This repository contains the News Pulse Admin Panel built with React, TypeScript, and Vite.

Production backend business logic belongs to the separate News Pulse backend service/repository.

Do not extend legacy/demo backend implementations in this repository for production features unless current code explicitly requires it.

## Authentication

The current primary Admin Panel login is email/password based.

Before modifying login/session behavior inspect:

- `src/context/AuthContext.tsx`
- `src/services/authService.ts`
- `src/components/auth/LoginForm.tsx`
- related tests

Historical magic-link/serverless authentication files may remain in the repository. Do not assume they are the primary authentication flow or extend them without first verifying current route usage.

`VITE_DEMO_MODE` has limited development behavior. Never convert it into an unrestricted authentication bypass.

## API Calls

Follow the repository's existing Admin API helpers and current proxy/direct-backend conventions.

Do not create a second unrelated API-client architecture.

Avoid duplicated `/api/api` or `/admin-api/admin-api` path construction.

## Founder and Staff Access

Preserve Founder protections, staff module permissions, account-control rights, and special-right checks.

When changing permissions, inspect the current access-control implementation and tests.

Do not bypass authorization just to make UI navigation work.

## Environment Safety

Localhost must remain isolated from production.

Read `docs/DEV_PROD_BACKEND_DB_SEPARATION.md`.

Never hardcode production credentials, tokens, secrets, database URLs, passwords, email credentials, or API keys.

Do not print or commit local `.env` contents.

## Security

Preserve the repository's secret-scanning protections, including Husky, gitleaks, GitHub workflows, and `scripts/test-hook.ps1`.

Do not broadly allowlist files to make a secret-scanning failure disappear.

## Documentation

Use:

- `BRAIN.md` for durable project context
- `README.md` for general developer guidance
- `ARCHITECTURE.md` only where it still matches current implementation
- environment-separation documentation for dev/prod safety

Verify old deployment/security documents against current code before relying on them.

## Change Discipline

Keep changes focused.

Before recommending commit, push, or deployment:

1. inspect `git status` and the exact diff
2. run applicable automated tests
3. run type checks when available
4. run the production build when appropriate
5. confirm no environment or secret files were unintentionally changed

Do not mix unrelated architectural cleanup into a feature change.
