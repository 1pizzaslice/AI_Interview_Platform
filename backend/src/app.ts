import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { config } from './config';
import { AppError } from './shared/errors/app-error';

import authRoutes from './features/auth/auth.routes';
import candidateRoutes from './features/candidate/candidate.routes';
import jobRoutes from './features/job/job.routes';
import interviewRoutes from './features/interview/interview.routes';
import reportRoutes from './features/report/report.routes';

export function createApp() {
  const app = express();

  // --- Security middleware ---
  app.use(helmet());
  app.use(
    cors({
      origin: config.NODE_ENV === 'production' ? false : '*',
      credentials: true,
    }),
  );

  // --- Body parsing ---
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // --- Static file serving for local uploads ---
  if (config.STORAGE_PROVIDER === 'local') {
    app.use('/uploads', express.static(path.resolve(config.UPLOAD_DIR)));
  }

  // --- Health check ---
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // --- API routes ---
  app.use('/api/auth', authRoutes);
  app.use('/api/candidates', candidateRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/interviews', interviewRoutes);
  app.use('/api/reports', reportRoutes);

  // --- 404 handler ---
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(AppError.notFound('Route not found'));
  });

  // --- Global error handler ---
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        success: false,
        error: { code: err.code, message: err.message },
      });
      return;
    }

    // Multer errors (file upload)
    if (err instanceof Error && err.message.startsWith('Only')) {
      res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: err.message },
      });
      return;
    }

    // Mongoose validation errors
    if (err instanceof Error && err.name === 'ValidationError') {
      res.status(422).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.message },
      });
      return;
    }

    console.error('[ErrorHandler] Unhandled error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  });

  return app;
}
