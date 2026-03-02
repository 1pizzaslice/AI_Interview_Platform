import { Router } from 'express';
import type { RequestHandler } from 'express';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import { getReportHandler, listMyReportsHandler, compareReportsHandler } from './report.controller';
import { getAnalyticsHandler } from './analytics.controller';
import { exportReportHandler } from './export.controller';
import { getCandidateFeedbackHandler } from './feedback.controller';

const router = Router();

router.use(requireAuth as RequestHandler);

router.get('/recruiter/me', requireRole('recruiter') as RequestHandler, listMyReportsHandler as unknown as RequestHandler);
router.get('/recruiter/analytics', requireRole('recruiter') as RequestHandler, getAnalyticsHandler as unknown as RequestHandler);
router.get('/recruiter/compare', requireRole('recruiter') as RequestHandler, compareReportsHandler as unknown as RequestHandler);
router.get('/:sessionId/export', requireRole('recruiter') as RequestHandler, exportReportHandler as unknown as RequestHandler);
router.get('/:sessionId/feedback', getCandidateFeedbackHandler as unknown as RequestHandler);
router.get('/:sessionId', requireRole('recruiter') as RequestHandler, getReportHandler as unknown as RequestHandler);

export default router;
