import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../shared/types';
import { createInterviewSchema } from '../../shared/validators';
import { AppError } from '../../shared/errors/app-error';
import * as interviewService from './interview.service';

export async function createSessionHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = createInterviewSchema.safeParse(req.body);
    if (!parsed.success) {
      next(AppError.badRequest(parsed.error.errors[0]?.message ?? 'Validation failed'));
      return;
    }
    const session = await interviewService.createSession(req.user.userId, parsed.data.jobRoleId);
    res.status(201).json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
}

export async function getSessionHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const session = await interviewService.getSession(req.params['id'] ?? '');

    if (req.user.role === 'candidate' && session.candidateId.toString() !== req.user.userId) {
      next(AppError.forbidden('Not authorized to view this session'));
      return;
    }

    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
}

export async function listMySessionsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sessions = await interviewService.listMySessions(req.user.userId);
    res.json({ success: true, data: sessions });
  } catch (err) {
    next(err);
  }
}

export async function listSessionsForJobHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sessions = await interviewService.listSessionsForJob(
      req.params['jobId'] ?? '',
      req.user.userId,
    );
    res.json({ success: true, data: sessions });
  } catch (err) {
    next(err);
  }
}

export async function startSessionHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const session = await interviewService.startSession(
      req.params['id'] ?? '',
      req.user.userId,
    );
    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
}
