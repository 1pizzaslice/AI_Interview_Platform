import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../shared/types';
import * as reportService from './report.service';

export async function getReportHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const report = await reportService.getReportBySession(req.params['sessionId'] ?? '');
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
}

export async function listMyReportsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const reports = await reportService.listReportsForRecruiter(req.user.userId);
    res.json({ success: true, data: reports });
  } catch (err) {
    next(err);
  }
}
