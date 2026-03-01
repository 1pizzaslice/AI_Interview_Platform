import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../shared/types';
import { createJobSchema, updateJobSchema } from '../../shared/validators';
import { AppError } from '../../shared/errors/app-error';
import * as jobService from './job.service';

export async function createJobHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = createJobSchema.safeParse(req.body);
    if (!parsed.success) {
      next(AppError.badRequest(parsed.error.errors[0]?.message ?? 'Validation failed'));
      return;
    }
    const job = await jobService.createJob(req.user.userId, parsed.data);
    res.status(201).json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
}

export async function listJobsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const jobs = await jobService.listJobs(req.user.role, req.user.userId);
    res.json({ success: true, data: jobs });
  } catch (err) {
    next(err);
  }
}

export async function getJobHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const job = await jobService.getJob(req.params['id'] ?? '');
    res.json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
}

export async function updateJobHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = updateJobSchema.safeParse(req.body);
    if (!parsed.success) {
      next(AppError.badRequest(parsed.error.errors[0]?.message ?? 'Validation failed'));
      return;
    }
    const job = await jobService.updateJob(req.params['id'] ?? '', req.user.userId, parsed.data);
    res.json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
}

export async function deleteJobHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const job = await jobService.deleteJob(req.params['id'] ?? '', req.user.userId);
    res.json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
}
