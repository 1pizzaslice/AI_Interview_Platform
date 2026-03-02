import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../shared/types';
import * as qbService from './question-bank.service';

export async function createQuestionBankHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const bank = await qbService.createQuestionBank(req.user.userId, req.body);
    res.status(201).json({ success: true, data: bank });
  } catch (err) {
    next(err);
  }
}

export async function listQuestionBanksHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const banks = await qbService.listQuestionBanks(req.user.userId);
    res.json({ success: true, data: banks });
  } catch (err) {
    next(err);
  }
}

export async function getQuestionBankHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const bank = await qbService.getQuestionBank(req.params['id'] ?? '', req.user.userId);
    res.json({ success: true, data: bank });
  } catch (err) {
    next(err);
  }
}

export async function updateQuestionBankHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const bank = await qbService.updateQuestionBank(req.params['id'] ?? '', req.user.userId, req.body);
    res.json({ success: true, data: bank });
  } catch (err) {
    next(err);
  }
}

export async function deleteQuestionBankHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await qbService.deleteQuestionBank(req.params['id'] ?? '', req.user.userId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
