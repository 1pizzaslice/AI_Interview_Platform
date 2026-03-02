import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../shared/types';
import * as pipelineService from './pipeline.service';

export async function listPipelineHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const entries = await pipelineService.listPipeline(req.user.userId, req.query.jobRoleId as string | undefined);
    res.json({ success: true, data: entries });
  } catch (err) { next(err); }
}

export async function addToPipelineHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const entry = await pipelineService.addToPipeline(req.user.userId, req.body);
    res.status(201).json({ success: true, data: entry });
  } catch (err) { next(err); }
}

export async function updateStageHandler(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const entry = await pipelineService.updateStage(
      req.params['id'] ?? '',
      req.user.userId,
      req.body.stage,
      req.body.notes,
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
