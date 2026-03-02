import { Router } from 'express';
import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import {
  createSessionHandler,
  getSessionHandler,
  listMySessionsHandler,
  listSessionsForJobHandler,
  startSessionHandler,
} from './interview.controller';

const router = Router();

const interviewCreateLimiter = rateLimit({
  windowMs: 3_600_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many interview sessions created, please try again later' } },
});

router.use(requireAuth as RequestHandler);

router.post('/', interviewCreateLimiter, requireRole('candidate') as RequestHandler, createSessionHandler as unknown as RequestHandler);
router.get('/me', listMySessionsHandler as unknown as RequestHandler);
router.get('/job/:jobId', requireRole('recruiter') as RequestHandler, listSessionsForJobHandler as unknown as RequestHandler);
router.get('/:id', getSessionHandler as unknown as RequestHandler);
router.patch('/:id/start', requireRole('candidate') as RequestHandler, startSessionHandler as unknown as RequestHandler);

export default router;
