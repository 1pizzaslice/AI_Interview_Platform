import { Router } from 'express';
import type { RequestHandler } from 'express';
import { requireAuth, requireRole } from '../auth/auth.middleware';
import {
  createQuestionBankHandler,
  listQuestionBanksHandler,
  getQuestionBankHandler,
  updateQuestionBankHandler,
  deleteQuestionBankHandler,
} from './question-bank.controller';

const router = Router();

router.use(requireAuth as RequestHandler);
router.use(requireRole('recruiter') as RequestHandler);

router.post('/', createQuestionBankHandler as unknown as RequestHandler);
router.get('/', listQuestionBanksHandler as unknown as RequestHandler);
router.get('/:id', getQuestionBankHandler as unknown as RequestHandler);
router.patch('/:id', updateQuestionBankHandler as unknown as RequestHandler);
router.delete('/:id', deleteQuestionBankHandler as unknown as RequestHandler);

export default router;
