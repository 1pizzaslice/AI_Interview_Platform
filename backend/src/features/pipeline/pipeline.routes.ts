import { Router } from 'express';
import type { RequestHandler } from 'express';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import {
  listPipelineHandler,
  addToPipelineHandler,
  updateStageHandler,
  removeFromPipelineHandler,
} from './pipeline.controller';

const router = Router();

router.use(requireAuth as RequestHandler);
router.use(requireRole('recruiter') as RequestHandler);

router.get('/', listPipelineHandler as unknown as RequestHandler);
router.post('/', addToPipelineHandler as unknown as RequestHandler);
router.patch('/:id', updateStageHandler as unknown as RequestHandler);
router.delete('/:id', removeFromPipelineHandler as unknown as RequestHandler);

export default router;
