import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { loginHandler, refreshHandler, meHandler } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const loginSchema = z.object({
  body: z.object({ email: z.string().email(), password: z.string().min(5) })
});

const refreshSchema = z.object({
  body: z.object({ refreshToken: z.string().min(10) })
});

router.post('/login', validate(loginSchema), loginHandler);
router.post('/refresh', validate(refreshSchema), refreshHandler);
router.get('/me', requireAuth, meHandler);

export default router;
