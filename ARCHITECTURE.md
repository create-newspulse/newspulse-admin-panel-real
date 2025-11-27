# NewsPulse Admin Architecture

## 1. Overview
The admin panel is a React + TypeScript application (Vite) backed by a consolidated Axios client. Core design goals:
- Single source of truth for API communication (`adminApi`).
- Layered safety for publishing pathways.
- Centralized domain typing to prevent drift.
- Deterministic error + debug instrumentation for low-noise production ops.

## 2. Core Modules
**`src/lib/adminApi.ts`** – Unified Axios instance with token helper; all admin endpoints route through this to ensure standardized headers/interceptors.

**`src/context/PublishFlagContext.tsx`** – Runtime publish flag provider. Combines env default (`PUBLISH_ENABLED`) with founder-only localStorage override. Components consume `publishEnabled` instead of raw env constants.

**`src/lib/articleWorkflowGuard.ts`** – Guard logic for article transitions. Enforces:
- Global publish flag.
- Founder-only publish.
- Checklist completeness.
- Stage correctness (schedule from `approved`; publish from `approved`/`scheduled`).

**`src/lib/bulkUploadGuard.ts`** – Sanitizes CSV bulk upload rows client-side; downgrades unsafe publish/schedule statuses when disabled or role insufficient.

**`src/lib/error.ts`** – Provides `normalizeError()` to standardize backend error shapes (message/auth expiration detection) and `appendError()` for accumulating messages.

**`src/lib/debug.ts`** – Controlled logging helper. Enabled by env or localStorage flag, replacing scattered `console.debug`.

**`src/types/api.ts`** – Central domain types: `Article`, `WorkflowChecklist`, `WorkflowState`, `CommunitySubmission*`, `ManageNewsParams`, normalization helpers.

## 3. Publishing Safety Layers
1. UI gating (buttons hidden/disabled when `publishEnabled` false).
2. Guard function checks before any transition POST (`publish`, `schedule`).
3. Bulk upload preflight sanitization.
4. Founder-only override of publish flag (auditable via debug logs).

## 4. Data Flow
- Components request data via React Query hooks calling `adminApi` wrappers (e.g., `listArticles`).
- Responses are normalized (community submissions) or passed through when already typed.
- Mutations use optimistic updates with typed caches (`ListResponse`).

## 5. Error & Expiration Handling
`normalizeError()` standardizes various backend payload shapes; sets `authExpired` flag when tokens fail validation so UI can prompt re-login instead of generic failure.

## 6. Adding New Features Safely
When introducing a new publishing-related action:
- Add UI gating via `publishEnabled`.
- Wrap backend call with `guardAction()` providing stage + checklist context.
- Add unit test replicating allowed vs blocked scenarios.

## 7. Extensibility Notes
- `approvals?: unknown[]` placeholder for future structured approval records (e.g., legal reviews). Define a typed `ApprovalRecord` interface once backend stabilizes.
- CSV parser currently basic (comma-split). If complex quoting emerges, swap for a lightweight CSV library and run `sanitizeBulkRows()` on parsed objects.

## 8. Observability Recommendations
- Emit structured logs for blocked actions: `{ type: 'publish_block', reason, userRole, articleId }`.
- Dashboard metrics: publish attempts (allowed vs blocked), schedule attempts, CSV sanitized count.

## 9. Security Considerations
- Never bypass `adminApi`; direct Axios instances risk losing interceptors.
- Keep publish flag override founder-only; consider adding a time-bound auto-reset (e.g., revert to env default at midnight UTC).
- Apply server-side validation mirroring guards (defense in depth).

## 10. Roadmap
- Formal approval workflow modeling (legal/editor steps typed).
- MFA integration on critical transitions (publish / schedule).
- Background job audit logging (scheduled -> published handover).

Maintained by NewsPulse Platform Engineering.

## 11. Transition Matrix (Publish & Schedule)
This matrix captures allowed actions given current article stage/status under safety layers. A transition must pass: UI gating -> `guardAction()` logic -> backend validation.

Legend: Y = allowed, N = blocked, F = founder-only, C = requires checklist complete, P = publish flag must be ON.

| Current Stage | Current Status  | Edit Content | Submit for Review | Approve (advance) | Schedule | Publish | Unpublish | Archive |
|---------------|-----------------|--------------|-------------------|-------------------|---------|--------|-----------|---------|
| draft         | draft           | Y            | Y (to review)     | N                 | N       | N       | N         | Y       |
| review        | draft           | Y            | N                 | Y (to legal/approved*) C | N | N | N | Y |
| legal         | draft           | Y            | N                 | Y (to approved) C | N | N | N | Y |
| approved      | draft           | Limited (non-structural) | N | N | Y (to scheduled) P F C | Y (to published) P F C | N | Y |
| scheduled     | scheduled       | Limited      | N                 | N                 | Y (reschedule) P F | Y (early publish) P F | Y (to draft) F | Y |
| published     | published       | Limited (typo fix) | N | N | N | N | Y (to draft: unpublish) F | Y (to archived) F |
| archived      | archived        | N (read-only) | N | N | N | N | N | N |
| deleted       | deleted         | N            | N                 | N                 | N       | N       | N         | N |

Notes:
- Checklist requirement (C) enforced before moving from review/legal to approved, and before schedule/publish from approved.
- Founder-only (F) applies to any action invoking publish flag pathways (schedule/publish/unpublish/archive).
- Publish flag (P) must be ON for schedule/publish operations; if OFF, UI hides buttons and guard rejects.
- Backend redundancy: server must re-check role, flag, and status integrity.

Guard Evaluation Order (simplified):
1. Global publishEnabled (if action pertains to publish/schedule/unpublish/archive).
2. Role check (founder requirement for publish-related actions).
3. Stage validity (e.g., only approved can schedule/publish).
4. Checklist completeness (rights, attribution, compliance, defamation scan).
5. Produce structured block reason if any fail (for logging & UI).

Example Block Reason Payload:
```json
{
	"action": "publish",
	"articleId": "abc123",
	"stage": "draft",
	"reason": "stage_not_ready",
	"requirements": {"requiredStage": "approved"},
	"userRole": "editor",
	"publishEnabled": true
}
```

Testing Guidelines:
- Unit tests assert each matrix edge (allowed vs blocked) returning success or specific reason code.
- Founder override tests: ensure allowed when flag ON and role=founder even if other non-critical conditions met.
- Negative tests for publishEnabled=false: schedule/publish/unpublish/archive blocked irrespective of role.
