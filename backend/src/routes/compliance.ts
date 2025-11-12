import { Router } from 'express';
import { ptiCheckBasic } from '../services/pti.js';

const router = Router();

router.post('/pti-check', (req,res) => {
  const { title, content } = req.body as { title?: string; content?: string };
  const result = ptiCheckBasic({ title, content });
  res.json(result);
});

export default router;
