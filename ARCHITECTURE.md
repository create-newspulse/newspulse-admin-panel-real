# News Pulse Admin Architecture

## 1. Scope and source of truth

News Pulse is LIVE in production. This document describes the current checked-in Admin Panel implementation, including differences between helper functions, mounted UI paths, and intended governance policy. It does not certify production configuration or backend authorization.

Current code and automated tests take precedence over this document and historical implementation reports. Durable change constraints live in [rules.md](./rules.md) and [BRAIN.md](./BRAIN.md). General developer guidance is in [README.md](./README.md).

The application is React 18 + TypeScript + Vite, with React Router and TanStack React Query. Production backend business logic belongs to a separate service/repository. Legacy/demo backend directories in this repository are not the production backend source of truth. Some repository-local serverless routes remain active through deployment rewrites, notably analytics.

## 2. Application entry, routing, and shell bootstrap

[src/main.tsx](./src/main.tsx) explicitly imports the TypeScript application entry, installs the router, query client, authentication and UI providers, and mounts error boundaries. [src/App.tsx](./src/App.tsx) owns the main route tree and adds the publishing-flag provider.

Representative current routes:

| Route                                                | Current component / boundary                                                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`, `/employee/login`                          | The same email/password `SimpleLogin` component; `/admin/login` redirects to `/login`.                                                |
| `/admin/articles`                                    | `ManageNews`, behind the `manage_news` module gate and `LockCheckWrapper`.                                                            |
| `/add`, `/admin/add-news`                            | `AddNews` / `ArticleForm`, behind the `add_news` module gate.                                                                         |
| `/admin/articles/:id/edit`                           | `ArticleEditPage` / `ArticleForm`, wrapped in `ProtectedRoute` and `LockCheckWrapper`, not the same module wrapper as the list route. |
| `/edit/:id`                                          | Retained `EditNews` workflow screen. Its wrapper names alone do not establish protection outside their path scope.                    |
| `/admin/settings/admin-panel/team`                   | Team Management, with the `team_management` module gate under the Settings Center.                                                    |
| `/admin/settings/admin-panel/founder-access-control` | Founder module-policy UI, wrapped in `FounderRoute` under the Settings Center.                                                        |
| `/admin/safe-owner-zone`                             | `ProtectedRoute`, lockdown wrapper, and the `safe_zone` module gate.                                                                  |

Compatibility redirects and the secondary [PanelRouter](./src/routes/PanelRouter.tsx) also remain; some panel pages are placeholders. Do not infer current protection from a route name, a legacy page, or a wrapper's name without checking its implementation.

### Shell readiness

[adminShellBootstrap.ts](./src/lib/adminShellBootstrap.ts), [AdminBootstrapLoader.tsx](./src/components/AdminBootstrapLoader.tsx), and `App` coordinate the primary shell:

- On paths classified as Admin Panel paths, the shell waits for local hydration, session resolution, any restoration/login in progress, a verified role, and the non-owner minimum effective-access lookup.
- While pending, the bootstrap gate replaces the navbar, owner bar, breadcrumbs, main route content, and command palette with a loading screen.
- A resolved unauthenticated Admin visit redirects to `/login` before the shell renders. Login pages are excluded from this shell block.
- Password-change flags can redirect an authenticated `/admin` visit to the appropriate account-password page.
- This is not a universal wrapper for every URL. Path classification and individual route guards still matter.

## 3. Authentication and sessions

The mounted login is [SimpleLogin.tsx](./src/pages/auth/SimpleLogin.tsx), using [AuthContext.tsx](./src/context/AuthContext.tsx). [LoginForm.tsx](./src/components/auth/LoginForm.tsx) and [authService.ts](./src/services/authService.ts) still exist, but are not the login component mounted at `/login`. Historical magic-link files are not the primary login architecture.

Current primary flow:

1. Email/password are sent as JSON to `POST /admin-api/admin/login` through the existing admin client.
2. The context accepts returned access/refresh tokens when present and supports credentialed cookie sessions. It then requests the authoritative profile at `GET /admin-api/admin/me`; failure or a response without a usable role rejects the login.
3. Hydration can migrate legacy token keys into the current token storage. Persisted session metadata is a timestamp, not an authoritative cached role. A token/session hint alone is not sufficient to release role-gated content.
4. Restoration requests the same profile endpoint with a 10-second timeout. Rejected or failed restoration clears local authentication and resolves loading state; a stale cookie hint must not keep the user authenticated after rejection.
5. Logout clears authentication storage, query caches, effective-access/feature-visibility caches, owner-unlock state, and related session state, then navigates to `/login`. This client cleanup is not a claim that all server sessions have been revoked.

Founder, Admin, and Employee accounts use the same primary authentication context. Authentication establishes identity; module access and action permissions are separate checks. There is no separate unrestricted Employee login flow.

## 4. Authorization, module policy, and Staff Access

### Route and role boundaries

- [AdminModuleRoute.tsx](./src/components/AdminModuleRoute.tsx) waits for authentication/profile and effective-access readiness, then resolves the requested module or module set. A denied module renders the denial screen. A module set permits a matching allowed module, not necessarily every module in the set.
- [ProtectedRoute.tsx](./src/components/ProtectedRoute.tsx) enforces its session and optional exact-role check on `/admin*` and `/employee*` paths; it returns children unchanged outside those prefixes.
- [FounderRoute.tsx](./src/components/FounderRoute.tsx) normally requires authenticated Founder access for `/admin*` paths. It returns children unchanged outside that prefix. It also retains a Vercel-hostname demo branch when `VITE_DEMO_MODE` is not `'false'`, and an authenticated-localhost relaxation controlled by `VITE_DEV_LOOSEN_FOUNDER_ROUTES`. These are existing wrapper-local exceptions, subject to surrounding shell/route gates, not general authorization guarantees or permission to broaden bypasses.
- [routes/guards.tsx](./src/routes/guards.tsx) contains additional guards used by the secondary panel router: `RequireAuth` is `/admin`-scoped, while `RequireRole` checks its explicit role allowlist.
- [LockCheckWrapper.tsx](./src/components/LockCheckWrapper.tsx) is a separate settings/lockdown/signature UI layer; it does not replace module or action authorization.

Role interpretation is not identical everywhere: the auth context's `isFounder` checks the `founder` role, while [role normalization](./src/lib/adminAccessControl.ts) and [owner navigation visibility](./src/lib/adminFeatureVisibility.ts) also recognize `owner`. Admin and other staff roles do not receive universal module access merely from their role name.

### Effective module access

[adminAccessControl.ts](./src/lib/adminAccessControl.ts), [adminModulePolicy.ts](./src/lib/adminModulePolicy.ts), and [useAdminEffectiveAccess.ts](./src/hooks/useAdminEffectiveAccess.ts) implement the current access model:

- Non-Founder effective module lists and special rights come from explicit saved fields plus individual allow/deny overrides. Role presets are not an automatic runtime fallback that fills an empty saved access list.
- Global module states are `available`, `staff_locked`, `hidden`, and `founder_only`. Missing configurable policy defaults to `founder_only`; Dashboard is a fixed available control and Safe Zone has a fixed Founder-only local policy.
- In local resolution, non-Founder access depends on account status/expiry, global policy, individual access, and temporary-grant expiry. `available` alone does not grant a staff member access. Hidden modules are invisible and denied; staff-locked modules can stay visible but inaccessible.
- The normalized Founder receives full access in local resolution. For other users, supplied backend effective-access entries are used when present, except for Dashboard's fixed-control handling. Do not describe this as the frontend independently revalidating every backend decision.
- The current-user hook calls `/access/me` through the shared HTTP helper, normally producing `GET /admin-api/access/me`. It normalizes backend/local module keys, caches by account identity and role, and deduplicates simultaneous startup requests. Founder loading is skipped.
- Policy-change events invalidate the effective-access result and trigger a refresh. Session changes and Staff Access saves clear the cache. A failed lookup settles the loader and records an error with default policy/no backend entries; it is not an unrestricted-access fallback.

[Navbar.tsx](./src/components/Navbar.tsx) uses the same effective-access information through [nav.ts](./src/config/nav.ts). Hidden and locked navigation states are distinct from allowed routes. Route access is not proof of permission for every action inside a page.

### Staff Access and account controls

[TeamManagement.tsx](./src/pages/admin/settings/admin-panel/TeamManagement.tsx) separates role presets, per-staff access, special rights, temporary grants, and account-control actions.

- Saving Staff Access explicitly requires the current user to be Founder, rejects protected Founder targets, and requires an audit reason of at least five characters.
- Dashboard and Safe Zone are not editable staff module grants. The UI also reserves a defined set of sensitive rights for Founder; ordinary staff grants do not change global Founder policy.
- Account actions use their own permissions/delegated rights and target/account-state checks. Protected Founder targets are excluded, and non-Founder delegated actions cannot target the acting user's own account. Access to Team Management alone is not permission to manage all accounts.
- [staffAccessSerializer.ts](./src/lib/staffAccessSerializer.ts) validates and maps local module/right names to backend contract keys, excludes fixed controls, and carries audit reasons, versions, and temporary grants.
- [teamManagementApi.ts](./src/api/teamManagementApi.ts) sends access changes to the `/admin-api/admin/team/access/staff/:id/...` endpoints. Module, special-right, task-right, and account-control updates use separate PATCH requests; temporary grants use POST requests. The save helper aggregates requests with `Promise.all`, not a single documented atomic update.
- After a successful save, the page updates its saved/draft snapshot, clears effective-access cache, and refetches the staff list. The API module also defines the per-staff `/effective-access` endpoint, distinct from the current-user `/access/me` lookup.

### Founder policy controls

[FounderAccessControl.tsx](./src/pages/admin/settings/admin-panel/FounderAccessControl.tsx) and [useFounderModulePolicy.ts](./src/hooks/useFounderModulePolicy.ts) manage the global policy separately from individual Staff Access. The mounted page has a Founder route boundary with the scope/exceptions described above.

The normal save flow requires a loaded valid backend version, an audit reason, and review/preview of the current draft. [ownerZone.ts](./src/api/ownerZone.ts) supplies module-policy load/preview/save/audit endpoints and sends the expected version. Conflicts preserve unsaved changes rather than silently overwriting policy. Bulk Founder-only restriction requires typed confirmation and preserves fixed controls.

These backend policy requests and their audit-reason fields are different from the local publishing toggle below. A frontend audit field is not proof of a durable backend audit record.

## 5. API clients and request contracts

There are several existing shared clients/helpers, not one Axios instance through which every request passes:

| Source                                                              | Current responsibility                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [adminApiClient.ts](./src/lib/adminApiClient.ts)                    | Axios client with `baseURL: '/admin-api'`, credentials, token attachment, and legacy path normalization; used by the article API and CSV upload. On eligible 401 responses it shares a refresh request to `/admin-api/admin/refresh`, retries once, and clears local auth/emits logout on refresh failure. |
| [api.ts](./src/lib/api.ts)                                          | Shared `api` and `adminApi` Axios instances, token helpers, URL normalization, and response handling. Current base resolution selects same-origin `/admin-api`; relative admin calls normalize under `/admin-api/admin/...`.                                                                               |
| [adminApi.ts](./src/lib/adminApi.ts)                                | Re-exports the shared admin client/token helper and provides compatibility/domain helpers. It is not the sole client for current article requests.                                                                                                                                                         |
| [http/adminFetch.ts](./src/lib/http/adminFetch.ts)                  | Fetch/JSON Admin helpers used by features such as Team Management. The default base is `/admin-api`; legacy relative base-path overrides are accepted, while absolute environment-origin overrides are ignored.                                                                                            |
| [http.ts](./src/lib/http.ts) and [apiBase.ts](./src/lib/apiBase.ts) | Existing fetch/URL wrappers used by effective access and Owner Zone APIs; they reuse the shared URL/token conventions.                                                                                                                                                                                     |

Preserve each feature's existing helper and contract. Token/error/refresh behavior is client-specific; do not assume these wrappers are interchangeable or that all direct `fetch` call sites use identical interceptors. Historical direct-backend configuration examples do not describe the current shared browser base resolution.

### Current article publishing request

[lib/api/articles.ts](./src/lib/api/articles.ts) implements the canonical modern publish operation:

```text
PUT /admin-api/articles/:encodedId
Body: { status: "published", publishedAt: "<ISO timestamp>" }
```

`publishArticle` encodes the ID and supplies the current timestamp when none is provided. `updateArticleStatus(id, 'published')` delegates to the same helper. The proxy normally forwards this to `/api/articles/:encodedId` on the backend.

Scheduling and other status changes use separate article helpers, generally PATCH with a PUT fallback. Scheduling sends `status: 'scheduled'` and `publishAt`; unscheduling sends draft status and clears schedule fields. These are not calls to a universal workflow-transition POST endpoint.

## 6. Publishing and editorial workflow

### Governance policy versus implementation

Founder oversight, editorial review, approval, and server-side authorization are governance/safety concerns. They are not evidence that every current frontend publishing action is Founder-only, approved-stage-only, or checked by the same helper. The actual paths below differ. Backend acceptance and enforcement cannot be established from this frontend repository alone.

### Existing workflow helper

[articleWorkflowGuard.ts](./src/lib/articleWorkflowGuard.ts) supports `toReview`, `toLegal`, `approve`, `schedule`, and `publish`. Its actual checks are:

| Check         | Current helper behavior                                                                                                                                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime flag  | Blocks `publish` and `schedule` when `publishEnabled` is false.                                                                                            |
| Founder       | Blocks `publish` only when `ctx.isFounder === false`; it does not impose that role check on `schedule`, and an omitted Founder field does not trigger it.  |
| Checklist     | Blocks `publish`/`schedule` only when `ctx.checklistOk === false`. Omitted checklist context is not rejected.                                              |
| Stage         | If a nonempty stage is provided, scheduling requires `approved`, and publishing requires `approved` or `scheduled`. Omitted stage context is not rejected. |
| Other actions | The helper does not validate review/legal/approval transitions or support unpublish/archive actions.                                                       |

Evaluation order is flag, publish-role check, checklist, then stage. The result is `{ allowed, reason? }` with a human-readable reason, not the former documented structured block-reason payload. There is no single enforced application-wide transition matrix.

### Actual mounted Admin UI behavior

- **News table:** [NewsTable.tsx](./src/components/news/NewsTable.tsx) shows publish/schedule actions on draft rows and disables them when the runtime flag is off. Those handlers call the article helpers directly without `guardAction`, an approved-stage requirement, or a per-row Founder check. Unpublish and unschedule handlers are not gated by that flag. Archive/restore controls admit the literal `admin`, `founder`, and `editor` roles; they are not Founder-only. Surrounding module gates and backend decisions remain separate.
- **Modern editor:** [ArticleForm.tsx](./src/components/news/ArticleForm.tsx) computes publish eligibility from the passed `userRole` (`admin` or `founder`), runtime flag, and required title/category/content checks. Its publish flow also performs form-specific checks, slug availability, and confirmations. Both [AddNews.tsx](./src/pages/AddNews.tsx) and [ArticleEditPage.tsx](./src/pages/ArticleEditPage.tsx) currently pass `userRole="admin"`. Thus this publish role prop is not itself an authoritative check of the signed-in user's role, even though other editor controls use authenticated role/special rights.
- The modern editor does not call the workflow guard or require an approved workflow stage/editorial workflow checklist. It persists the article as a draft first, then invokes the canonical PUT publish helper. Ordinary create saves use draft status; autosave preserves the existing status rather than constituting the explicit publish action.
- **Manage News bulk transitions:** [ManageNews.tsx](./src/pages/ManageNews.tsx) calls the workflow helper with `isFounder`, but without stage/checklist context. Bulk publish then uses `publishArticle`; non-publish workflow transitions still POST to `/news/:id/transition` through the shared API client.
- **Retained legacy editor:** [EditNews.tsx](./src/pages/EditNews.tsx) supplies stage, checklist, and Founder context to the guard, then posts its legacy actions to `/news/:id/transition`. This retained path is not the modern `NewsTable`/`ArticleForm` publishing contract.

### Runtime publish toggle

[config/publishing.ts](./src/config/publishing.ts) enables the default only when `VITE_PUBLISH_ENABLED === 'true'`. [PublishFlagContext.tsx](./src/context/PublishFlagContext.tsx) reads a local override from `np_publish_enabled_override`.

The effective override is honored only when `AuthContext.isFounder` is true, and [ManageNews.tsx](./src/pages/ManageNews.tsx) renders its toggle controls only for Founder. The setter itself updates React state and localStorage; it does not independently check the caller's role.

**Override changes are not audit-logged by this setter or the toggle handlers.** There is no server-side flag update, shared cross-user policy, or automatic expiry implemented by this context. Do not confuse it with global module-policy controls or backend authorization.

## 7. CSV import: CURRENT IMPLEMENTATION GAP / known safety gap

[bulkUploadGuard.ts](./src/lib/bulkUploadGuard.ts) returns copied rows with publish/schedule statuses downgraded to draft when the flag is off or the user is not Founder, clearing `scheduledAt` in downgraded rows. For an enabled Founder it also normalizes `schedule` to `scheduled`.

However, [UploadCsvDialog.tsx](./src/components/news/UploadCsvDialog.tsx):

1. Parses the CSV with basic line/comma splitting and extracts status/schedule fields.
2. Calls the sanitizer but uses only its `changed` count for the preflight message.
3. Calls the mutation with the **original `File`**, appending that unchanged file to `FormData`.
4. Sends `POST /admin-api/articles/bulk-upload`.

**The sanitized rows are not serialized or uploaded.** The UI can report that rows were sanitized while the transmitted CSV still contains the original statuses. This is an existing frontend safety gap, not a completed fix or a guaranteed publishing safeguard. The basic parser also is not a robust quoted-CSV parser.

Backend sanitization/authorization is outside this frontend description and must not be assumed. Documenting this gap does not authorize fixing it during documentation-only work.

## 8. Queries, mutations, types, and errors

### Query and mutation behavior

The query client in [main.tsx](./src/main.tsx) defaults to a 10-second query stale time, no query/mutation retries, and no automatic refetch on window focus or reconnect. Individual features can set their own query options.

- In [NewsTable.tsx](./src/components/news/NewsTable.tsx), publish, schedule, unpublish, unschedule, archive, and restore mutations invalidate `['articles']` on settlement; active queries can then refetch.
- Soft delete removes affected rows after success and invalidates related queries. Some hard-delete paths have explicit optimistic cache updates. That is not a property of all mutations.
- [ArticleForm.tsx](./src/components/news/ArticleForm.tsx) invalidates article queries after successful saves and manages editor-specific state separately.
- [UploadCsvDialog.tsx](./src/components/news/UploadCsvDialog.tsx) invalidates article queries after a successful upload.
- Staff Access and Founder policy use their own state, reload/cache, and event flows described above, not a universal React Query optimistic-mutation layer.

### Domain types

[types/api.ts](./src/types/api.ts) includes shared community-submission, article-summary, workflow, and Manage News parameter types. `WorkflowState.approvals` is already `ApprovalRecord[]`; `ApprovalRecord` has `role` and `at`, plus optional ID, user identity fields, and note.

[lib/api/articles.ts](./src/lib/api/articles.ts) also defines its own richer `Article` and `ListResponse` types, with article-status types in [types/articles.ts](./src/types/articles.ts). Domain typing is therefore not completely centralized in one file. Typed approval records do not establish enforcement of an approval workflow on every publish path.

### Error and debug helpers

[error.ts](./src/lib/error.ts) provides safe message selection, normalization, and message accumulation. Normalization sets `authExpired` for HTTP 401/419; the clients/context handle their respective refresh/logout/session behavior.

[debug.ts](./src/lib/debug.ts) provides conditional console logging controlled by localStorage/environment/development mode. This is not a durable audit service, nor a guarantee that every action or console log uses this helper.

## 9. Local/development and production API isolation

The isolation requirement is local Admin/public applications -> development backend/database, and production applications -> production backend/database. See [DEV_PROD_BACKEND_DB_SEPARATION.md](./docs/DEV_PROD_BACKEND_DB_SEPARATION.md) for that safety goal; verify operational examples against current code rather than assuming older direct-mode or bundled-backend guidance remains authoritative.

### Local development

[package.json](./package.json) runs [scripts/vite-dev-root.mjs](./scripts/vite-dev-root.mjs) for development. It launches Vite from the repository root. Both [vite.config.js](./vite.config.js) and [vite.config.ts](./vite.config.ts) exist; do not assume only the TypeScript configuration can be selected.

The root configs currently use port 5173 and default the development backend to `http://localhost:5000`. The dedicated target variables are `VITE_ADMIN_API_TARGET` and `VITE_DEV_PROXY_TARGET`. Normal mapping is:

```text
Browser /admin-api/... -> local Vite proxy -> development backend /api/...
```

The configs also proxy `/api` and normalize duplicate API prefixes. Shared browser API-base resolution remains same-origin; setting an absolute `VITE_API_URL` is not the supported way to retarget those browser clients.

The development configs reject certain production-like targets, including the production admin host and Vercel/Render hostnames, and warn for other valid non-local targets. **This is not proof that every permitted custom target uses a development database.** A dedicated target can be non-local; its environment must still be verified without accessing production data. Do not disable the checks or point localhost at production.

### Production deployment routing

[vercel.json](./vercel.json) currently:

- Routes `/admin-api/analytics/:path*` and `/admin-api/api/analytics/:path*` to the repository-local [analytics report handler](./api/admin/analytics/report.js).
- Rewrites the remaining `/admin-api/:path*` requests directly to the separately hosted backend's `/api/:path*`, using the origin recorded in that configuration.
- Serves the SPA entry for the remaining frontend routes.

Do not describe all `/admin-api` traffic as a generic serverless proxy selected by an environment variable; the current committed rewrite table has a direct external-backend mapping and an analytics exception. Vite's development proxy is not the production routing mechanism.

These are checked-in routing rules, not a live verification of deployment settings, credentials, or database connections. The Admin Panel does not establish which database the separate backend is using.

## 10. Automated evidence and maintenance boundaries

Relevant existing tests include:

- [Workflow guard tests](./tests/articleWorkflowGuard.test.ts) and [bulk-row sanitizer tests](./tests/bulkUploadGuard.test.ts).
- [Modern publish request contract](./src/lib/api/__tests__/articles.publish.test.ts).
- [Session restoration](./src/context/__tests__/AuthContext.restoreSession.test.tsx), [shell bootstrap](./src/lib/__tests__/adminShellBootstrap.test.ts), and [module-route readiness](./src/components/__tests__/AdminModuleRoute.authReady.test.tsx).
- [Module policy resolution](./src/lib/__tests__/adminAccessControl.policy.test.ts) and [effective-access loading/cache behavior](./src/hooks/__tests__/useAdminEffectiveAccess.test.tsx).
- [Staff Access serialization](./src/lib/__tests__/staffAccessSerializer.test.ts), [Staff Access API contracts](./src/api/__tests__/teamManagementApi.staffAccess.test.ts), [Staff Access save behavior](./src/pages/admin/settings/admin-panel/__tests__/TeamManagement.accessSave.test.tsx), and [Founder policy UI](./src/pages/admin/settings/admin-panel/__tests__/FounderAccessControl.test.tsx).
- [Browser API-base resolution](./src/lib/__tests__/apiBaseResolution.test.ts) and [article/admin client behavior](./src/lib/__tests__/adminApiClient.test.ts).

Helper tests establish their asserted behavior only: sanitizer tests do not prove that uploaded CSV bytes were rewritten, and guard tests do not prove every UI action invokes the guard. Do not reinstate an application-wide transition matrix or claim end-to-end enforcement without tracing the entry points and corresponding tests.

Keep documentation corrections separate from runtime fixes. Any change to the known gaps, authorization, publishing, sessions, API contracts, or environment behavior requires its own approved scope and focused validation under [rules.md](./rules.md).
