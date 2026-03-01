import { Router } from 'express';
import type { RequestHandler } from 'express';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import { getReportHandler, listMyReportsHandler } from './report.controller';

const router = Router();

router.use(requireAuth as RequestHandler);

router.get('/recruiter/me', requireRole('recruiter') as RequestHandler, listMyReportsHandler as unknown as RequestHandler);
router.get('/:sessionId', getReportHandler as unknown as RequestHandler);

export default router;
