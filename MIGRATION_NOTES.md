# Migration Notes — Module Consolidation (Nov 2025)

This document summarizes the consolidation of several admin modules and the new navigation/tabs introduced.

## Consolidations

- AI Assistant → merged into AI Engine
  - Legacy route `/admin/ai-assistant` now redirects to `/admin/ai-engine`.
- Founder Control → merged into Safe Owner Zone
  - Legacy routes `/admin/founder-control` and `/admin/founder` now redirect to `/safe-owner`.
- Settings → merged into Safe Owner Zone
  - Legacy route `/admin/settings` now redirects to `/safe-owner?tab=settings`.
- Push History → integrated under Workflow
  - Legacy route `/push-history` now redirects to `/admin/workflow?tab=push-history`.
- Panel Guide → moved to private docs
  - Live route removed; keep docs under `src/pages/SafeOwner/PanelGuide.tsx` for reference.

## Tabs

- Safe Owner Zone now supports query-param tabs:
  - `?tab=overview` (default)
  - `?tab=settings` (embeds Admin Control Center)
  - `?tab=ai` (KiranOS Panel + AI Trainer)
  - `?tab=security` (placeholder card; heavy module separate)
  - `?tab=analytics` (placeholder)

- Workflow has internal tabs via query param:
  - `?tab=queue` (pipeline board)
  - `?tab=push-history` (embedded Push History)
  - `?tab=schedules`, `?tab=automation`, `?tab=logs` (placeholders)

- AI Engine surfaces sub-tools via `?tool=`:
  - `generator`, `summarizer`, `ranker`, `translator`, `diagnostics`

## Manage News UX Improvements

- Tags field is now a chip input (add with Enter/comma; remove via ×).
- Category filter is a multi-select chip list (maps to CSV query param; backend maps to `$in`).
- Optimistic updates for Archive/Restore/Delete in the table with rollback on error.

## Backend Compatibility

- Category filters accept CSV (e.g., `?category=Breaking,Business`).
- The `/api/articles` meta and CRUD endpoints are unchanged.

## Deployment Notes

- SPA redirects for legacy routes are defined in `src/App.tsx`.
- No server rewrite rules are required beyond existing Vercel proxy setup.

If any legacy bookmarks are used, the SPA redirects keep them functional while pointing to the consolidated destinations.
