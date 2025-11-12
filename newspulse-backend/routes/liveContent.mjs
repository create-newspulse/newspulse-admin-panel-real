import { Router } from 'express';
import LiveContent from '../models/LiveContent.mjs';
import sanitize from '../utils/sanitizeEmbed.mjs';

const router = Router();

router.get('/', async (_req,res)=>{
  try { const d = await LiveContent.getSingleton(); res.json({mode:d.mode, embedCode:d.embedCode, updatedAt:d.updatedAt}); }
  catch { res.status(500).json({error:'fetch failed'}); }
});

router.post('/update', async (req,res)=>{
  try{
    const { mode, embedCode } = req.body||{};
    if(!['inspiration','live'].includes(mode)) return res.status(400).json({error:'bad mode'});
    const d = await LiveContent.getSingleton();
    d.mode = mode; d.embedCode = sanitize(embedCode||''); await d.save();
    const io = req.app.get('io');
    if (io) {
      console.log('[live-content] emitting live-content-updated');
      io.emit('live-content-updated',{mode:d.mode, embedCode:d.embedCode, updatedAt:d.updatedAt});
    } else {
      console.warn('[live-content] io not available on app at emit time');
    }
    res.json({ ok:true, mode:d.mode, embedCode:d.embedCode, updatedAt:d.updatedAt });
  }catch{ res.status(500).json({error:'update failed'}); }
});

export default router;
