import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { createSchema, updateSchema, listSchema,
         createArticle, updateArticle, getArticle, listArticles, deleteArticle } from '../controllers/articles.controller.js';

const router = Router();

router.get('/', validate(listSchema), listArticles);
router.get('/:id', requireAuth, getArticle);

router.post('/',
  requireAuth,
  requireRole('owner','editor','reporter'),
  validate(createSchema),
  createArticle
);

router.put('/:id',
  requireAuth,
  requireRole('owner','editor'),
  validate(updateSchema),
  updateArticle
);

router.delete('/:id',
  requireAuth,
  requireRole('owner','editor'),
  deleteArticle
);

export default router;
