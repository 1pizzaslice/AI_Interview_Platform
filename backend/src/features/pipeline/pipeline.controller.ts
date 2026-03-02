import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../shared/types';
import { addToPipelineSchema, updatePipelineStageSchema } from '../../shared/validators';
import { AppError } from '../../shared/errors/app-error';
import * as pipelineService from './pipeline.service';

export async function listPipelineHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const entries = await pipelineService.listPipeline(req.user.userId, req.query.jobRoleId as string | undefined);
    res.json({ success: true, data: entries });
  } catch (err) { next(err); }
}

export async function addToPipelineHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = addToPipelineSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.badRequest(parsed.error.errors.map(e => e.message).join(', '));
    }
    const entry = await pipelineService.addToPipeline(req.user.userId, parsed.data);
    res.status(201).json({ success: true, data: entry });
  } catch (err) { next(err); }
}

export async function updateStageHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = updatePipelineStageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.badRequest(parsed.error.errors.map(e => e.message).join(', '));
    }
    const entry = await pipelineService.updateStage(
      req.params['id'] ?? '',
      req.user.userId,
      parsed.data.stage,
      parsed.data.notes,
    );
    res.json({ success: true, data: entry });
  } catch (err) { next(err); }
}

export async function removeFromPipelineHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await pipelineService.removeFromPipeline(req.params['id'] ?? '', req.user.userId);
    res.json({ success: true });
  } catch (err) { next(err); }
}
