# Live TV for NewsPulse — Product, API, Safety, and Agent Prompts

This document defines how NewsPulse Live TV should work end-to-end, the core data model and API surface, mandatory safety/compliance rules, and three copy-paste prompts for your VS Code Agent to build both the frontend and admin control, plus the AI Anchor (AIRA) scheduler.

---

## 1) Product idea — end-to-end

Live TV allows editors to surface a verified live stream (e.g., YouTube Live, X/Twitter, Facebook, PMO/CMO streams, Parliament TV) anywhere in the product: as a homepage hero, a top banner strip, or an in-article block. If the source fails or is flagged unsafe, the system fails over automatically to a safe fallback: a Breaking News slideshow or an AI Anchor voice bulletin (AIRA).

- Founder/Admin control: in Admin → Live TV Control (/admin/live)
  - Paste URL or embed code
  - Toggle ON/OFF; optionally schedule time windows
  - Pick display mode: HERO, BANNER, IN_ARTICLE
  - Configure ticker (text/speed/show), language, region tags
  - Run PTI/Trust and Safety Guard before publish; founder can override with a reason
  - Log all actions to the System Intelligence Panel

- Frontend (user side):
  - If Live ON and SAFE → render stream with "🔴 LIVE" badge and optional ticker
  - If live down or unsafe → auto fallback (SLIDESHOW or AI_ANCHOR)
  - Supports iframe, HLS, DASH; mobile-optimized; optional mini PiP player on scroll

---

## 2) Data model & API outline (copyable)

### TypeScript models

```ts
// models/LiveFeed.ts
export type LiveFeed = {
  _id: string;
  title: string;                 // "PM's Address", "Diwali Celebrations", etc.
  sourceType: 'YOUTUBE' | 'X' | 'FACEBOOK' | 'IFRAME' | 'HLS' | 'DASH' | 'OTHER';
  rawInput: string;              // pasted URL or full embed code
  sanitizedEmbedHtml?: string;   // server-generated sanitized embed
  hlsUrl?: string;               // optional direct stream
  isActive: boolean;             // master ON/OFF
  displayMode: 'HERO' | 'BANNER' | 'IN_ARTICLE';
  startAt?: string;              // ISO, optional schedule
  endAt?: string;                // ISO, optional schedule
  ticker?: { text: string; speed?: number; show?: boolean };
  language?: 'en' | 'hi' | 'gu';
  regionTags?: string[];         // e.g. ['Gujarat','National']
  ptiCompliance: { status: 'PENDING'|'PASS'|'FAIL'; notes?: string };
  safety: { status: 'SAFE'|'RISKY'|'BLOCKED'; reason?: string };
  fallback: { mode: 'SLIDESHOW'|'AI_ANCHOR'|'NONE' };
  createdBy: string;             // founder/admin id
  updatedAt: string;
};

export type AnchorSchedule = {
  _id: string;
  cron: string;                  // e.g. "0 * 7-23 * *" (hourly 07:00–23:00)
  languagePriority?: Array<'en'|'hi'|'gu'>;
  enabled: boolean;
  createdBy: string;
  updatedAt: string;
};

export type AnchorBulletin = {
  _id: string;
  language: 'en'|'hi'|'gu';
  script: string;                // PTI-compliant script
  audioUrl: string;              // TTS output
  captionsUrl?: string;          // optional WebVTT
  createdAt: string;
};

export type AuditLog = {
  _id: string;
  actorId: string;
  action: string;                // e.g. LIVE_CREATE, LIVE_ACTIVATE, PTI_PASS, PTI_FAIL
  targetId?: string;             // liveFeedId or scheduleId
  meta?: Record<string, any>;
  createdAt: string;
};
```

### REST API surface

```
POST   /api/live/create             // create live feed entry (rawInput paste)
PUT    /api/live/:id                // update settings (ON/OFF, displayMode, ticker, language, regionTags, fallback, schedule)
POST   /api/live/:id/sanitize       // server builds sanitizedEmbedHtml from rawInput
POST   /api/live/:id/validate       // run PTI/safety checks (oEmbed/meta fetch)
POST   /api/live/:id/activate       // force ON (reruns safety/pti); may require founder override
POST   /api/live/:id/deactivate     // OFF
GET    /api/live/active             // public endpoint: returns currently active and SAFE feed (or last good + fallback)
GET    /api/live/schedule           // returns upcoming schedule blocks

POST   /api/anchor/run              // trigger AI Anchor bulletin now
POST   /api/anchor/schedule         // define recurring anchor schedule (cron-like)
GET    /api/anchor/schedule         // list schedules
PUT    /api/anchor/schedule/:id     // update schedule
POST   /api/anchor/script           // generate PTI-compliant script from verified sources
POST   /api/anchor/voice            // synthesize TTS for a script

GET    /api/audit/logs?targetId=... // audit entries for a feed/schedule
```

#### Request/Response sketches

- POST /api/live/create
```json
{
  "title": "Parliament Session",
  "rawInput": "https://www.youtube.com/watch?v=...",
  "sourceType": "YOUTUBE"
}
```
Response
```json
{ "data": { "_id": "lf_123", "ptiCompliance": {"status":"PENDING"}, "safety": {"status":"SAFE"}, "isActive": false, "displayMode": "HERO", "updatedAt": "2025-11-06T10:00:00Z" } }
```

- POST /api/live/:id/sanitize → { data: { sanitizedEmbedHtml } }
- POST /api/live/:id/validate → { data: { ptiCompliance:{status,notes}, safety:{status,reason} } }
- POST /api/live/:id/activate → { data: LiveFeed } (403 if safety/pti fail without founder override)
- GET  /api/live/active → { data: { feed?: LiveFeed, fallback: 'SLIDESHOW'|'AI_ANCHOR'|'NONE' } }

---

## 3) Safety & compliance guardrails (PTI/ethics)

Mandatory before “Go Live”:

1) Source allowlist & embed sanitization
- Allow only vetted hosts (YouTube, X/Twitter, Facebook, official gov domains). 403 for others unless founder override.
- Strip scripts and inline JS; sandbox iframe; set referrerpolicy; allow="autoplay; encrypted-media; picture-in-picture"; disallow popups.

2) Metadata & health checks
- If HLS/DASH, HEAD/GET must return 200 with valid content-type.
- For embeds, fetch oEmbed or HEAD; validate title/channel and cross-check against allowlist.

3) PTI compliance gate
- Run PTICompliance.check(rawInput|oEmbed): PASS/FAIL + notes.
- Only PASS can activate; founder override logs reason and actorId.

4) Crisis mode
- If platform flags/DMCA/removes: auto deactivate, alert admins, immediately switch to fallback (AIRA or slideshow).

5) Copyright & attribution
- Show attribution for source channel/organization; embed only public official sources.

6) Audit logging
- Log every create/update/activate/deactivate; include pti status, safety, actor, timestamp.

7) Ethics & AIRA
- Neutral, factual, crisis-aware tone.
- No opinionated language; ensure disclaimer for developing stories.
- Safe-words list and redaction paths in script pipeline.

---

## 4) Ready-to-run prompts for your VS Code Agent

Below are three prompts you can paste directly to your agent. They include goals, tasks, and acceptance checks.

### Prompt A: Frontend Live TV (Next.js)

Goal: Build a production-ready Live TV frontend for NewsPulse (Next.js App Router + Tailwind + shadcn/ui), powered by /api/live/active and /api/live/schedule.

Tasks:
- Components:
  - components/live/LiveBadge.tsx → blinking 🔴 with aria-label, reduced-motion fallback
  - components/live/Ticker.tsx → smooth marquee, pause on hover/focus
  - components/live/EmbedGuard.tsx → SSR-safe, renders sanitizedEmbedHtml in sandboxed iframe
  - components/live/LivePlayer.tsx (props: { feed: LiveFeed })
    - if feed.hlsUrl → hls.js; else iframe via EmbedGuard
    - supports HERO/BANNER/IN_ARTICLE variants
    - fallback UI if missing or safety≠SAFE
  - components/live/FallbackSlideshow.tsx → GET /api/news/top?limit=6, headline slides
  - components/live/AnchorBulletin.tsx → AIRA audio + slides when fallback=AI_ANCHOR
- Pages/slots:
  - app/live/page.tsx → full Live TV page (Hero, Ticker, Share, Topic chips)
  - app/(home)/LiveHero.tsx → conditional hero if live active
  - components/article/LiveEmbedBlock.tsx → render inside articles when isActive && mode==='IN_ARTICLE'
- Data hooks:
  - hooks/useActiveLiveFeed.ts → fetch /api/live/active with SWR (revalidate every 15s)
  - hooks/useLiveSchedule.ts → fetch /api/live/schedule
- Mobile UX:
  - mini PiP-like floating card when scrolled away; tap to expand
- Accessibility:
  - keyboard controls, focus rings, aria labels; captions track if available
- Visual polish:
  - glossy dark card, rounded-2xl, gradient header, "Verified by AI" badge
- Error/failover:
  - if no active or safety≠SAFE → show FallbackSlideshow or AnchorBulletin
- Types:
  - types/live.ts matching the LiveFeed model in this doc

Acceptance:
- SSR-safe; no window access on server.
- Lighthouse a11y ≥ 95 on sample page.
- No external libs except hls.js, clsx, swr, shadcn/ui.

### Prompt B: Admin “Live TV Control” (React/Vite or Next.js)

Goal: Build Admin → Live TV Control (/admin/live) to paste/manage live sources with ON/OFF, scheduling, compliance, and fallback.

Tasks:
- Cards/sections:
  - Paste & Parse: textarea for URL/embed; buttons Detect Provider / Sanitize / Preview
  - Controls: master ON/OFF (must call /validate first), display mode, language, region tags, ticker, fallback
  - Schedule: start/end datetime; cron builder; preview next 5 occurrences client-side
  - Compliance & Safety: Run PTI/Trust Check; show PASS/FAIL + notes; founder override requires reason
  - Preview: sandboxed iframe, simulate failure → show fallback
  - Audit Log: table of actions (time, user, action, status, PTI result)
- API wiring:
  - POST /api/live/create; POST /:id/sanitize; POST /:id/validate; POST /:id/activate; POST /:id/deactivate; PUT /:id
- Security:
  - Role guard: role in ['founder','admin-live']
  - Server sanitization + allowlist; never trust client-side preview for publish
- UX polish:
  - Status bar: 🟢 Online | PTI: PASS | Fallback: AI Anchor | Next: 19:00 IST
  - Motion transitions, toasts on each action

Acceptance:
- Prevent Activate unless validate PASS or founder override reason provided.
- All changes logged to /api/audit/logs.
- Responsive + keyboard accessible.

### Prompt C: AI Anchor (AIRA) module & scheduler

Goal: Implement AIRA, a female AI Anchor that can run on schedule or as fallback. Voice is natural, ethical, PTI-aware.

Tasks:
- Script pipeline:
  - POST /api/anchor/script → inputs: topic tags, duration, language
  - Pull from /api/news/verified?tags=...; summarize; produce neutral PTI-compliant script with attribution
- Voice/TTS:
  - POST /api/anchor/voice → inputs: script, language → outputs MP3/OGG URL; store file path + transcript
- Bulletin renderer:
  - components/anchor/Bulletin.tsx → avatar, lower-thirds, animated bullets, plays TTS; captions toggle
- Scheduler:
  - POST /api/anchor/schedule → cron-like rules (hourly 07:00–23:00)
  - On trigger: generate script → voice → publish a bulletin consumed when live is OFF
- Ethics & PTI Guard:
  - PTICompliance.check(script) → if FAIL, rewrite or mark BLOCKED; auto disclaimers
- Admin controls:
  - Allow AIRA auto-fill when live is OFF; language priority; max length; safe words list

Acceptance:
- If external live is risky/unavailable, AIRA takes over within ≤ 5s with “This is a live desk update…”
- All bulletins stored and playable with captions.

---

## 5) Implementation notes

- Always run server-side sanitization; client preview is only a hint.
- Store sanitizedEmbedHtml and re-sanitize on edits.
- Scheduling should respect timezone in config and render ISO in API.
- For HLS, prefer native playback on Safari; fallback to hls.js elsewhere.
- Mini-player should respect reduced-motion and pause ticker on hover/focus.
- Ensure CORS & CSP allow embeds from allowlisted providers; lock down everything else.
