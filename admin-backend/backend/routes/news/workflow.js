// 📁 backend/routes/news/workflow.js
const express = require('express');
const router = express.Router();
const News = require('../../models/News');
const verifyToken = require('../../middleware/verifyToken');
const { requireRole } = require('../../middleware/rbac');

// GET /api/news/:id/workflow - fetch workflow state
router.get('/:id/workflow', verifyToken, requireRole(['editor','managing-editor','admin','founder']), async (req, res) => {
  try {
    const doc = await News.findById(req.params.id).select('status workflow title');
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, status: doc.status, workflow: doc.workflow, title: doc.title });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /api/news/:id/checklist - update PTI checklist (partial updates)
router.post('/:id/checklist', verifyToken, requireRole(['editor','legal','managing-editor','admin','founder']), async (req, res) => {
  try {
    const updates = req.body || {};
    const doc = await News.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });

    doc.workflow = doc.workflow || {};
    doc.workflow.checklist = { ...(doc.workflow.checklist || {}), ...updates };
    await doc.save();
    res.json({ success: true, checklist: doc.workflow.checklist });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /api/news/:id/transition - move workflow forward with guardrails
// Body: { action: 'toReview'|'toLegal'|'approve'|'schedule'|'publish', when?: Date }
router.post('/:id/transition', verifyToken, requireRole(['editor','managing-editor','admin','founder']), async (req, res) => {
  try {
    const { action, when } = req.body || {};
    const doc = await News.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });

    const c = (doc.workflow && doc.workflow.checklist) || {};
    const ok = {
      pti: !!c.ptiCompliance,
      rights: !!c.rightsCleared,
      attribution: !!c.attributionPresent,
      defamation: !!c.defamationScanOk,
    };

    // Simple transition rules
    switch (action) {
      case 'toReview':
        doc.status = 'review';
        doc.workflow.stage = 'copy-edit';
        break;
      case 'toLegal':
        doc.status = 'legal';
        doc.workflow.stage = 'legal';
        break;
      case 'approve':
        if (!(ok.pti && ok.rights && ok.attribution)) {
          return res.status(400).json({ success: false, message: 'Checklist incomplete (PTI/Rights/Attribution required)' });
        }
        doc.status = 'approved';
        doc.workflow.stage = 'eic-approve';
        doc.workflow.approvals = [...(doc.workflow.approvals||[]), { by: req.user?.email || 'unknown', role: req.user?.role || 'unknown' }];
        break;
      case 'schedule':
        if (!(ok.pti && ok.rights && ok.attribution)) {
          return res.status(400).json({ success: false, message: 'Cannot schedule until checklist passes' });
        }
        doc.status = 'scheduled';
        doc.workflow.stage = 'scheduled';
        doc.scheduledAt = when ? new Date(when) : new Date(Date.now() + 10*60*1000);
        break;
      case 'publish':
        if (!(ok.pti && ok.rights && ok.attribution && ok.defamation)) {
          return res.status(400).json({ success: false, message: 'Publish blocked by checklist (PTI/Rights/Attribution/Defamation)' });
        }
        // Only founder/admin/managing-editor can publish directly
        const role = (req.user?.role || '').toLowerCase();
        if (!['founder','admin','managing-editor'].includes(role)) {
          return res.status(403).json({ success: false, message: 'Publish requires elevated role' });
        }
        doc.status = 'published';
        doc.workflow.stage = 'published';
        doc.scheduledAt = null;
        break;
      default:
        return res.status(400).json({ success: false, message: 'Unknown action' });
    }

    await doc.save();
    res.json({ success: true, status: doc.status, workflow: doc.workflow, scheduledAt: doc.scheduledAt });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
