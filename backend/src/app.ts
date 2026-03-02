import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import rateLimit from 'express-rate-limit';
import * as Sentry from '@sentry/node';
import { config } from './config';
import { AppError } from './shared/errors/app-error';
import { logger } from './lib/logger';

import authRoutes from './features/auth/auth.routes';
import candidateRoutes from './features/candidate/candidate.routes';
import jobRoutes from './features/job/job.routes';
import interviewRoutes from './features/interview/interview.routes';
import reportRoutes from './features/report/report.routes';
import questionBankRoutes from './features/question-bank/question-bank.routes';
import pipelineRoutes from './features/pipeline/pipeline.routes';

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

  // --- Rate limiting ---
  const globalLimiter = rateLimit({
    windowMs: 60_000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests, please try again later' } },
  });

  const authLoginLimiter = rateLimit({
    windowMs: 60_000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many login attempts, please try again later' } },
  });

  const authRegisterLimiter = rateLimit({
    windowMs: 60_000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many registration attempts, please try again later' } },
  });

  const interviewCreateLimiter = rateLimit({
    windowMs: 3_600_000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many interview sessions created, please try again later' } },
  });

  const resumeUploadLimiter = rateLimit({
    windowMs: 3_600_000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many resume uploads, please try again later' } },
  });

  app.use('/api', globalLimiter);
  app.use('/api/auth/login', authLoginLimiter);
  app.use('/api/auth/register', authRegisterLimiter);

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
  app.use('/api/interviews', interviewCreateLimiter, interviewRoutes);
  app.use('/api/candidates/resume', resumeUploadLimiter);
  app.use('/api/reports', reportRoutes);
  app.use('/api/question-banks', questionBankRoutes);
  app.use('/api/pipeline', pipelineRoutes);

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

    Sentry.captureException(err);
    logger.error({ err }, 'Unhandled error');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    });
  });

  return app;
}
