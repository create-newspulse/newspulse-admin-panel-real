# Content Ingestion, AI Processing, and Delivery

This document maps the requested feature flow to what already exists in the repo and defines a concrete MVP with APIs, data shapes, and next steps.

## 1) Content Ingestion & Creation

Existing assets:
- scripts/fetchDroneTV.js — sample news/source fetcher (ingestion scaffold)
- api/rss-proxy.ts — serverless RSS proxy to fetch/normalize feeds
- pages/admin/LiveFeedManager.tsx — UI for managing live feeds
- api/news-ticker.ts — serverless function for ticker data

MVP additions:
- admin-backend/backend/services/ingest/rssIngestor.js — poll feeds, dedupe, normalize
- admin-backend/backend/services/ingest/sourceRegistry.json — list of sources, categories, langs
- Cron: run every 2–5 minutes; enqueue jobs for AI processing

Data shape: ArticleRaw
```json
{
  "sourceId": "string",
  "externalId": "string",
  "title": "string",
  "url": "string",
  "publishedAt": "ISO-8601",
  "author": "string",
  "lang": "auto|en|hi|...",
  "contentHtml": "string",
  "contentText": "string",
  "ingestMeta": {"fetchedAt": "ISO-8601", "checksum": "string"}
}
```

## 2) Content Management (CMS)

Existing assets:
- admin-backend/backend/models/News.js — Mongo model for articles, tags, status
- src/pages/AddNews.tsx, EditNews.tsx, ManageNews.tsx — admin CMS UIs
- src/components/advanced/EditorialWorkflowEngine.tsx — workflow scaffolding

MVP additions:
- Status pipeline: DRAFT → AI_PROCESSING → READY → PUBLISHED → ARCHIVED
- Audit fields on News model: `ai.summaryAt`, `ai.tags`, `ai.models` (versions), `ai.errors`

## 3) AI Processing (Translation, Summarization, Tagging, Personalization)

Existing assets:
- api/ai-engine.ts — serverless orchestration for AI actions (OpenAI client available)
- admin-backend/ai/openaiClient.js — reusable OpenAI wrapper
- admin-backend/ai/headlineRanker.js — scoring/ranking logic
- src/pages/AISummarizer.tsx — UI to test summarization
- src/hooks/useTranslate.ts — client helper; i18next configured
- src/components/advanced/AIEditorialAssistant.tsx — UI assist components

MVP services (Node workers or queue consumers):
- services/ai/summarize.js — produce `summaryShort`, `summaryLong`
- services/ai/translate.js — translate to target langs array
- services/ai/tagger.js — output `tags[]`, `categories[]`, `keywords[]`
- services/ai/profileEmbed.js — generate embeddings for personalization

Processing data shape: ArticleProcessed
```json
{
  "newsId": "ObjectId",
  "summaries": {"short": "string", "long": "string"},
  "translations": {"hi": {"title": "...", "summary": "..."}},
  "tags": ["politics", "economy"],
  "categories": ["India"],
  "keywords": ["RBI", "inflation"],
  "embedding": {"model": "text-embedding-3-large", "vector": [0.01, ...]},
  "metrics": {"cost": 0.002, "latencyMs": 1400},
  "errors": []
}
```

API contracts (admin-backend):
- POST /api/ingest/enqueue { sourceId? } → 202
- POST /api/ai/process/:newsId { tasks: ["summarize","translate","tag"] } → 202
- GET  /api/news/:newsId → News + ai fields

## 4) Content Delivery

Existing assets:
- Vercel SPA build to dist (vite) + CDN
- api/news-ticker.ts — serverless ticker

MVP additions:
- CDN-friendly payloads: /api/public/news?lang=en&limit=20
- Cache-Control headers (s-maxage, stale-while-revalidate) on serverless

## 5) Personalization & Interaction

Existing assets:
- ai/headlineRanker.js (ranking kernel)
- Analytics/AI activity UIs: AIActivityLog, AnalyticsDashboard, MonitorHubPanel

MVP plan:
- Track anonymous user events (view/click) → event stream (serverless endpoint)
- Nightly job computes user or segment profiles → store vectors/interests
- Personalized feed endpoint: /api/reco/feed?userId=... or segment cookie

### Edge cases
- Duplicates across sources (URL and checksum dedupe)
- Very long articles (chunk and summarize, respect token limits)
- Timeouts/rate limits (retry w/ backoff)
- Non-news content and spam (rule-based + model filter)

### Success criteria
- <5 min from ingest to publish for 95% of items
- Summaries in 2 languages (en + hi) for 90% of items
- CTR uplift ≥ 10% on personalized home compared to baseline

## Immediate next steps (MVP week)
1. Ingestor + queue scaffold, dedupe, and create News(DRAFT)
2. Summarize + tag workers using existing openaiClient
3. Translate to configured langs; persist to News.ai
4. Public API for latest articles; cache headers set
5. Wire CMS status view to show AI progress; manual override buttons
6. Add event capture endpoint (view/click) for later personalization

All of this reuses existing code where possible and slots into admin-backend services to avoid touching the SPA except for new UI panels and toggles.
