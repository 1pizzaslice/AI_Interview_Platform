import { Router } from 'express';
import type { RequestHandler } from 'express';
import { requireAuth } from './auth.middleware';
import {
  registerHandler,
  loginHandler,
  refreshHandler,
  logoutHandler,
} from './auth.controller';

const router = Router();

router.post('/register', registerHandler as RequestHandler);
router.post('/login', loginHandler as RequestHandler);
router.post('/refresh', refreshHandler as RequestHandler);
router.post(
  '/logout',
  requireAuth as RequestHandler,
  logoutHandler as unknown as RequestHandler,
);

export default router;
