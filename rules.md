# News Pulse Admin Panel - Safety Rules

News Pulse is LIVE in production. Treat this Admin Panel as a production-sensitive system, including when working locally.

## 1. Read and audit before editing

- Read [BRAIN.md](./BRAIN.md), the relevant current implementation and tests, and [development/production separation guidance](./docs/DEV_PROD_BACKEND_DB_SEPARATION.md) before changing behavior.
- Use current code and automated tests as the source of truth. Historical completion reports, comments, deployment notes, and intended policies are not proof of current enforcement.
- Use [ARCHITECTURE.md](./ARCHITECTURE.md) as a source-linked implementation guide, not as a substitute for inspecting the affected code.
- Trace the actual mounted route, UI action, permission checks, API helper, and relevant tests before deciding what to change.
- Separate intended governance policy, implemented behavior, and known gaps. Do not silently describe a gap as fixed.

## 2. Keep changes small and scoped

- Make the smallest safe change that fully addresses the approved task. Avoid unrelated cleanup, refactoring, formatting, renaming, and architecture changes.
- Preserve existing working UI/UX, navigation, routes, forms, loading states, error handling, and API behavior unless the approved task explicitly requires a change.
- Documentation-only tasks must remain documentation-only. Record implementation gaps without fixing runtime code, permissions, configuration, dependencies, or production data.
- Preserve existing documentation filenames and references unless a rename is explicitly requested.
- Inspect the worktree before editing. Preserve unrelated changes and integrate existing edits in any file you touch. Stop for guidance if changes conflict; never reset or revert someone else's work.

## 3. Preserve authentication and authorization

- Preserve email/password login, session restoration, authoritative role/profile loading, logout cleanup, refresh handling, and Admin shell/bootstrap sequencing.
- Preserve Founder protection, staff account protections, module policy, individual module access, effective-access resolution, special rights, and delegated account-control checks.
- Do not equate access to a module with permission to perform every action inside it. Inspect the action's own checks and API contract.
- Do not replace saved staff access with broad role defaults or treat an Admin/Employee role as unrestricted access.
- Do not weaken authorization, remove a guard, change a fixture to grant extra rights, or introduce a bypass merely to make navigation or tests pass.
- Do not broaden demo/development exceptions into general authentication or Founder-access bypasses.

## 4. Preserve API contracts and environment isolation

- Reuse the existing API helper used by the affected feature. Preserve request methods, paths, payloads, credentials, token handling, error behavior, and proxy normalization.
- Preserve the current same-origin Admin API/proxy behavior. Do not introduce a second client architecture or duplicate `/api/api` or `/admin-api/admin-api` prefixes.
- Production backend business logic belongs to the separate backend service. Do not extend legacy/demo backend code in this repository for production features without explicit scope and verified current usage.
- Keep localhost/development isolated from production backends, databases, authentication, email, OTP delivery, and other production services.
- Never silently retarget a local proxy to production or weaken environment-separation checks to make localhost work.
- Do not modify production data. Do not access production data or services merely to validate local or documentation work.
- Configuration and code inspection are not proof of the deployed environment or database isolation; do not claim live verification without an authorized verification task.

## 5. Protect confidential data and existing safeguards

- Do not expose secrets, credentials, passwords, access/refresh tokens, personal information, or backend-private data in source, documentation, logs, screenshots, command output, or external services.
- Do not print or commit local/production environment-file contents. Use non-sensitive placeholders and synthetic test data.
- Preserve the existing Husky, gitleaks, allowlist, CI secret-scanning protections, and [local hook harness](./scripts/test-hook.ps1).
- Do not broadly allowlist files or disable a scanner to hide a failure.

## 6. Dependencies and validation

- Do not install, remove, upgrade, downgrade, or otherwise change packages, dependency manifests, or lockfiles without explicit approval for that work.
- Use the repository's existing validation tools. If a required tool or dependency is missing, report the blocker rather than installing it without approval.
- Run focused tests for approved behavior changes; run `npm run typecheck` and `npm run build` when appropriate to the change.
- Documentation-only changes do not require application tests, typecheck, or a production build unless documentation tests exist or another explicit requirement applies.
- Before handoff, run `git diff --check` and `git status`, check the changed-file scope, and verify that unrelated runtime, environment, secret, and dependency files were not changed.
- Check newly created documentation for whitespace errors and broken local references as well; untracked files are not included in a normal `git diff --check`.
- Report what was validated, what was not run, any remaining gaps, and the final worktree state. Do not present passing helper tests as proof of untested end-to-end behavior.

## 7. Founder approval and handoff

- No commit, push, or deployment without explicit Founder approval.
- Approval to edit documentation is not approval to fix an implementation gap or publish the changes.
- At handoff, identify files created/updated, explain the corrections, list validation results and git status, and disclose any runtime changes.
- When Founder review is requested, stop after the handoff and wait. Do not stage, commit, push, deploy, or continue into runtime fixes on your own.
