import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../shared/types';
import { exportReportAsCSV, exportReportAsPDF } from './export.service';

export async function exportReportHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sessionId = req.params['sessionId'] ?? '';
    const format = (req.query.format as string) ?? 'csv';

    if (format === 'pdf') {
      const pdf = await exportReportAsPDF(sessionId);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="report-${sessionId}.pdf"`);
      res.send(pdf);
    } else {
      const csv = await exportReportAsCSV(sessionId);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="report-${sessionId}.csv"`);
      res.send(csv);
    }
  } catch (err) {
    next(err);
  }
}
