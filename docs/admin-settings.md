# Admin Settings Dashboard

This dashboard provides a centralized, versioned site settings document with validation and role-based access. All settings are saved via the proxy API in production and a local serverless fallback in demo.

## API
- GET /api/admin/settings: Returns current `site_settings` document. If none, returns defaults (`defaultSiteSettings`).
- PUT /api/admin/settings: Updates settings; merges into full document, increments `version`, returns merged object; emits audit metadata.
- PATCH /api/admin/settings: Same as PUT, partial updates.
- GET /api/public/settings: Returns safe public settings (ui, navigation, voice) for frontend consumption.
- Proxy mode: Use `/admin-api/admin/settings` from the frontend; maps to `${ADMIN_BACKEND_URL}/api/admin/settings`.

## Sections
- Frontend UI: Visibility toggles, `theme`, `density`.
- Navigation: `enableTopNav`, `enableSidebar`, `enableBreadcrumbs`.
- Publishing: `autoPublishApproved`, `reviewWorkflow`, `defaultVisibility`.
- AI Modules: `editorialAssistant`, `autoSummaries`, `contentTagging`, `model`.
- Voice & Languages: `ttsEnabled`, `ttsVoice`, `rtlEnabled` (admin-only UI), `languages`.
- Community: `reporterPortalEnabled`, `commentsEnabled`, `moderationLevel`.
- Monetization: `adsEnabled`, `sponsorBlocks`, `membershipEnabled`.
- Integrations: `analyticsEnabled`, `analyticsProvider`, `newsletterProvider`.
- Security (founder-only): `lockdown`, `twoFactorRequired`, `allowedHosts`.
- Backups (founder-only): `enabled`, `cadence`.
- Audit Logs: `enabled`, `retentionDays`.

## Validation
All settings are validated via a single zod schema at `src/types/siteSettings.ts` and saved atomically.

## Role Checks
- Security and Backups sections require founder role; the sidebar hides these for non-founders and routes enforce `FounderRoute`.

## Export / Import (Founder-only)
- Export: Button in Settings header downloads current settings as JSON.
- Import: Upload JSON to replace settings; validated against schema.

## Public Frontend
- No public LTR/RTL toggle UI is exposed; `rtlEnabled` applies only within admin tooling unless intentionally surfaced elsewhere.
- Frontend integration (SSR/SPA): Fetch `/api/public/settings` on startup and apply visibility toggles.

### Example (SPA)
```ts
fetch('/api/public/settings')
	.then(r => r.json())
	.then(({ ui, navigation, voice }) => {
		// apply UI visibility
		state.ui = ui;
		// apply navigation flags
		state.nav = navigation;
		// apply language/rtl
		document.dir = voice.rtlEnabled ? 'rtl' : 'ltr';
	})
	.catch(() => {/* fallback to baked defaults */});
```
