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

export async function compareReportsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { sessionIds } = req.query as { sessionIds?: string };
    if (!sessionIds) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'sessionIds query param required' } });
      return;
    }
    const ids = sessionIds.split(',').slice(0, 4); // max 4
    const reports = await reportService.getReportsBySessionIds(ids);
    res.json({ success: true, data: reports });
  } catch (err) {
    next(err);
  }
}
