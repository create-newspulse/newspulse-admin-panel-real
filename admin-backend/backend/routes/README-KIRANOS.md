# KiranOS Command Center API

This folder adds a lightweight KiranOS API for the new command center UI.

Routes mounted at `/api/kiranos`:

- POST `/ask` — Body: `{ query: string, userId?: string, lang?: 'en'|'hi'|'gu', adminMode?: boolean }`
  - Pipeline:
    1. Check internal analytics endpoints (`/api/analytics/*`)
    2. If no context, optional Google Custom Search (requires `GOOGLE_API_KEY` and `GOOGLE_CSE_ID`)
    3. OpenAI completion (model from `OPENAI_MODEL`, default `gpt-4o-mini`)
  - Returns: `{ answer, sources, voiceUrl }`

- POST `/speak` — Body: `{ text, lang }`
  - Currently returns `501` unless a TTS provider key is present. Frontend falls back to browser speech synthesis.

Environment:

- `OPENAI_API_KEY` (required for AI responses)
- `OPENAI_MODEL` (optional)
- `GOOGLE_API_KEY`, `GOOGLE_CSE_ID` (optional external knowledge)
- `BING_SEARCH_KEY`, `BING_ENDPOINT` (optional, not yet wired)

Security:

- The UI passes `X-Admin-Mode: 1` for founder-only views; route behaves safely if not set.
- For production, wire to your auth middleware to check founder/admin.

Notes:

- This is a minimal, non-streaming implementation that can be upgraded to SSE.
- Logging to MongoDB can be added by introducing a simple Mongoose model (e.g., `KiranOSLog`).
