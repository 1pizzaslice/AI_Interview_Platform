import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../shared/types';
import * as analyticsService from './analytics.service';

export async function getAnalyticsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { jobRoleId, dateFrom, dateTo } = req.query as {
      jobRoleId?: string;
      dateFrom?: string;
      dateTo?: string;
    };

    const analytics = await analyticsService.getAnalytics({
      recruiterId: req.user.userId,
      jobRoleId,
      dateFrom,
      dateTo,
    });

    res.json({ success: true, data: analytics });
  } catch (err) {
    next(err);
  }
}
