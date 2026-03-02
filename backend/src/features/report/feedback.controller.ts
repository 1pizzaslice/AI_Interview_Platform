import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../shared/types';
import { getCandidateFeedback } from './feedback.service';

export async function getCandidateFeedbackHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sessionId = req.params['sessionId'] ?? '';
    const feedback = await getCandidateFeedback(sessionId, req.user.userId);
    res.json({ success: true, data: feedback });
  } catch (err) {
    next(err);
  }
}
