import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../shared/types';
import { AppError } from '../../shared/errors/app-error';
import * as candidateService from './candidate.service';

export async function getMeHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const profile = await candidateService.getMyProfile(req.user.userId);
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

export async function updateMeHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { name } = req.body as { name?: string };
    const profile = await candidateService.updateMyProfile(req.user.userId, { name });
    res.json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
}

export async function uploadResumeHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file) {
      next(AppError.badRequest('No file uploaded'));
      return;
    }
    const candidate = await candidateService.uploadAndParseResume(req.user.userId, req.file);
    res.json({ success: true, data: candidate });
  } catch (err) {
    next(err);
  }
}
