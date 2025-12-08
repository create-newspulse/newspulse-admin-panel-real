# Render backend: /api/ai-activity-log route

This patch adds a small Express route to your Render backend repo (create-newspulse/newspulse-backend-real) so the Admin panel's Safe Owner "AI Activity Log" shows live metrics.

It works if you have a `News` mongoose model; if not, it safely falls back to zeros.

---

## 1) Add the route file

Create `backend/routes/safezone/aiActivityLog.js` (or `src/routes/safezone/aiActivityLog.js` if your repo uses `src/`).

```js
// backend/routes/safezone/aiActivityLog.js
// Returns lightweight AI activity metrics for the Admin panel.

const express = require('express');
const router = express.Router();

let NewsModel = null;
try {
  // Adjust the path if your models live elsewhere
  NewsModel = require('../../models/News');
} catch (_) {
  // Model not found; we'll fall back to raw collection queries or zeros
}

const countDocs = async (query) => {
  if (NewsModel) {
    return NewsModel.countDocuments(query).catch(() => 0);
  }
  try {
    const mongoose = require('mongoose');
    if (mongoose?.connection?.db) {
      const col = mongoose.connection.db.collection('news'); // change if your collection name differs
      if (col) return col.countDocuments(query);
    }
  } catch (_) {}
  return 0;
};

router.get('/', async (_req, res) => {
  try {
    // These predicates match the admin panel's expectations; tweak to your schema if needed
    const [autoPublished, flagged, suggestedHeadlines] = await Promise.all([
      countDocs({ publishedBy: 'AI' }),
      countDocs({ isFlagged: true }),
      countDocs({ isSuggested: true }),
    ]);

    const lastTrustUpdate = new Date().toISOString();

    res.status(200).json({
      autoPublished: autoPublished || 0,
      flagged: flagged || 0,
      suggestedHeadlines: suggestedHeadlines || 0,
      lastTrustUpdate,
    });
  } catch (err) {
    console.error('ai-activity-log error:', err?.stack || err?.message || err);
    res.status(200).json({
      // Soft success with zeros so the UI stays clean even if DB hiccups
      autoPublished: 0,
      flagged: 0,
      suggestedHeadlines: 0,
      lastTrustUpdate: new Date(0).toISOString(),
    });
  }
});

module.exports = router;
```

If your backend uses ESM, convert the `require/module.exports` lines to:

```js
import express from 'express';
const router = express.Router();
import mongoose from 'mongoose';
let NewsModel = null;
try { NewsModel = (await import('../../models/News.js')).default || (await import('../../models/News.js')); } catch {}
// ...same route body...
export default router;
```

---

## 2) Mount the route in your server

In your main server file (e.g., `server.js` or `src/server.js` / `app.js`):

CommonJS:
```js
const aiActivityLog = require('./backend/routes/safezone/aiActivityLog'); // adjust path
app.use('/api/ai-activity-log', aiActivityLog);
```

ESM:
```js
import aiActivityLog from './backend/routes/safezone/aiActivityLog.js'; // adjust path
app.use('/api/ai-activity-log', aiActivityLog);
```

Mount it after your JSON/body parsers, and inside the same app where your other `/api/*` routes live.

---

## 3) Deploy to Render

- Push to the GitHub repo connected to your Render service (`newspulse-backend-real`). Render should auto-deploy.
- If auto-deploy is off, click "Manual deploy" in Render.

### Quick verification (after deploy)
- Open: `https://<your-render-app>.onrender.com/api/ai-activity-log`
- You should see JSON:
  ```json
  { "autoPublished": 0, "flagged": 0, "suggestedHeadlines": 0, "lastTrustUpdate": "..." }
  ```
- Then open the admin panel:
  - https://admin.newspulse.co.in/safe-owner → the AI Activity Log panel should now show numbers (0+ if you have data).

---

## 4) Notes
- The Admin panel reads these exact keys: `autoPublished`, `flagged`, `suggestedHeadlines`, `lastTrustUpdate`.
- If your schema is different, edit the predicates in the route accordingly.
- This endpoint is meant to be lightweight and safe; it returns zeros instead of 500 on transient DB errors.
