const express = require('express');
const router = express.Router();
const Snapshot = require('../models/Snapshot');
const Escalation = require('../models/Escalation');
const { ensureFounderPin } = require('../utils/ensureFounder');
const { verifyPin } = require('../utils/pin');
const { audit } = require('../utils/audit');
const crypto = require('node:crypto');
// Import runner to dispatch escalation alerts tied to founder actions
const { runEscalation } = require('../utils/runner');

// Simple in-memory state for demo only
let LOCK_STATE = 'UNLOCKED';
let LAST_SNAPSHOT = null;
let SNAPSHOT_LIST = []; // echo of created snapshots for list endpoint (demo)

router.post('/lockdown', async (req, res) => {
  await ensureFounderPin();
  const { reason = 'unspecified', scope = 'site', pin } = req.body || {};
  if (!pin) return res.status(400).json({ ok: false, error: 'PIN required' });
  const ok = await verifyPin(pin);
  if (!ok) return res.status(401).json({ ok: false, error: 'Invalid PIN' });
  LOCK_STATE = 'LOCKED';
  try { await audit('security.lockdown.triggered', 'founder', 'FOUNDER', { reason, scope }); } catch {}
  try { await runEscalation('security.lockdown.triggered', 'L3', { title: 'Lockdown activated', text: `Scope: ${scope}. Reason: ${reason}` }); } catch {}
  return res.json({ ok: true, state: LOCK_STATE, scope, reason, at: new Date().toISOString() });
});

router.post('/unlock', async (req, res) => {
  await ensureFounderPin();
  const { pin } = req.body || {};
  if (!pin) return res.status(400).json({ ok: false, error: 'PIN required' });
  const ok = await verifyPin(pin);
  if (!ok) return res.status(401).json({ ok: false, error: 'Invalid PIN' });
  LOCK_STATE = 'UNLOCKED';
  try { await audit('security.unlock.performed', 'founder', 'FOUNDER', {}); } catch {}
  try { await runEscalation('security.unlock.performed', 'L1', { title: 'System unlocked', text: 'Founder restored operations' }); } catch {}
  return res.json({ ok: true, state: LOCK_STATE, at: new Date().toISOString() });
});

router.post('/snapshot', async (req, res) => {
  const { note = '' } = req.body || {};
  const id = `snap_${Date.now()}`;
  // Gather artifacts (expandable)
  const escalation = await Escalation.findOne().lean();
  const artifacts = { escalation: escalation || null };
  const checksum = crypto.createHash('sha256').update(JSON.stringify(artifacts)).digest('hex');
  const doc = await Snapshot.create({ snapshotId: id, checksum, note, artifacts });
  LAST_SNAPSHOT = { id, checksum: doc.checksum, note: doc.note, at: doc.createdAt };
  // keep a lightweight memory mirror for list API
  SNAPSHOT_LIST.push(LAST_SNAPSHOT);
  try { await audit('system.snapshot.created', 'founder', 'FOUNDER', { id, checksum, note }); } catch {}
  return res.json({ ok: true, id, checksum: doc.checksum, note: doc.note, at: doc.createdAt });
});

router.post('/rollback', async (req, res) => {
  const { snapshotId, dryRun = true } = req.body || {};
  if (!snapshotId) return res.status(400).json({ ok: false, error: 'snapshotId required' });
  const snap = await Snapshot.findOne({ snapshotId }).lean();
  if (!snap) return res.status(404).json({ ok: false, error: 'snapshot not found' });
  // Compute diff between snapshot artifacts and current
  const current = { escalation: await Escalation.findOne().lean() };
  function computeDiff(a, b, basePath = ''){
    const rows = [];
    const keys = new Set([...(a ? Object.keys(a) : []), ...(b ? Object.keys(b) : [])]);
    for (const k of keys) {
      const p = basePath ? `${basePath}.${k}` : k;
      const av = a ? a[k] : undefined; const bv = b ? b[k] : undefined;
      if (av && typeof av === 'object' && bv && typeof bv === 'object') rows.push(...computeDiff(av, bv, p));
      else if (JSON.stringify(av) !== JSON.stringify(bv)) rows.push({ path: p, from: av, to: bv, impact: 'low' });
    }
    return rows;
  }
  const diff = computeDiff(snap.artifacts, current);
  if (dryRun) return res.json({ ok: true, dryRun: true, snapshotId, checksum: snap.checksum, diff, at: new Date().toISOString() });
  // Apply rollback to persisted settings
  if (snap.artifacts && snap.artifacts.escalation) {
    await Escalation.findOneAndUpdate({}, snap.artifacts.escalation, { upsert: true });
  }
  try { await audit('system.rollback.applied', 'founder', 'FOUNDER', { snapshotId }); } catch {}
  return res.json({ ok: true, dryRun: false, snapshotId, checksum: snap.checksum, at: new Date().toISOString() });
});

// --- Added list + diff endpoints (mirroring Next.js API spec) ---
router.get('/snapshots', async (_req, res) => {
  // Prefer DB list, fallback to memory mirror
  const items = await Snapshot.find({}, { _id: 0, snapshotId: 1, checksum: 1, note: 1, createdAt: 1 }).sort({ createdAt: -1 }).limit(100).lean();
  if (items && items.length) {
    return res.json({ ok: true, items: items.map(d => ({ id: d.snapshotId, checksum: d.checksum, note: d.note, at: d.createdAt })) });
  }
  return res.json({ ok: true, items: SNAPSHOT_LIST });
});

router.get('/snapshots/:id/diff', async (req, res) => {
  const { id } = req.params;
  const snap = await Snapshot.findOne({ snapshotId: id }).lean();
  if (!snap) return res.status(404).json({ ok: false, error: 'snapshot not found' });
  const current = { escalation: await Escalation.findOne().lean() };
  function computeDiff(a, b, basePath = ''){
    const rows = [];
    const keys = new Set([...(a ? Object.keys(a) : []), ...(b ? Object.keys(b) : [])]);
    for (const k of keys) {
      const p = basePath ? `${basePath}.${k}` : k;
      const av = a ? a[k] : undefined; const bv = b ? b[k] : undefined;
      if (av && typeof av === 'object' && bv && typeof bv === 'object') rows.push(...computeDiff(av, bv, p));
      else if (JSON.stringify(av) !== JSON.stringify(bv)) rows.push({ path: p, before: av, after: bv, impact: 'low' });
    }
    return rows;
  }
  const rows = computeDiff(snap.artifacts, current);
  return res.json({ ok: true, snapshotId: id, rows });
});

module.exports = router;
