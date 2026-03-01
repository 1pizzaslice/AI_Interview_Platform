import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../shared/types';
import { verifyAccessToken, extractBearerToken } from '../../shared/utils';
import { AppError } from '../../shared/errors/app-error';

export function requireAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    next(AppError.unauthorized('No token provided'));
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(AppError.unauthorized('Invalid or expired token'));
  }
}

export function requireRole(...roles: Array<'candidate' | 'recruiter'>) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden(`Requires role: ${roles.join(' or ')}`));
      return;
    }
    next();
  };
}
