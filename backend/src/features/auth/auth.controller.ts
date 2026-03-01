import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../shared/types';
import { registerSchema, loginSchema, refreshTokenSchema } from '../../shared/validators';
import { AppError } from '../../shared/errors/app-error';
import * as authService from './auth.service';

export async function registerHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      next(AppError.badRequest(parsed.error.errors[0]?.message ?? 'Validation failed'));
      return;
    }
    const result = await authService.register(parsed.data);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      next(AppError.badRequest(parsed.error.errors[0]?.message ?? 'Validation failed'));
      return;
    }
    const result = await authService.login(parsed.data);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function refreshHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = refreshTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      next(AppError.badRequest('refreshToken is required'));
      return;
    }
    const result = await authService.refresh(parsed.data.refreshToken);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function logoutHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await authService.logout(req.user.userId);
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    next(err);
  }
}
