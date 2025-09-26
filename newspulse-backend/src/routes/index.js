import { Router } from 'express';
import auth from './auth.routes.js';
import articles from './articles.routes.js';
// import categories from './categories.routes.js' ...
const router = Router();

router.use('/auth', auth);
router.use('/articles', articles);
// router.use('/categories', categories);
// router.use('/media', media);
// router.use('/users', users);
// router.use('/settings', settings);

export default router;
