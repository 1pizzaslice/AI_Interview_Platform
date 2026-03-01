import { Router } from 'express';
import type { RequestHandler } from 'express';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import {
  createJobHandler,
  listJobsHandler,
  getJobHandler,
  updateJobHandler,
  deleteJobHandler,
} from './job.controller';

const router = Router();

router.use(requireAuth as RequestHandler);

router.post('/', requireRole('recruiter') as RequestHandler, createJobHandler as unknown as RequestHandler);
router.get('/', listJobsHandler as unknown as RequestHandler);
router.get('/:id', getJobHandler as unknown as RequestHandler);
router.patch('/:id', requireRole('recruiter') as RequestHandler, updateJobHandler as unknown as RequestHandler);
router.delete('/:id', requireRole('recruiter') as RequestHandler, deleteJobHandler as unknown as RequestHandler);

export default router;
