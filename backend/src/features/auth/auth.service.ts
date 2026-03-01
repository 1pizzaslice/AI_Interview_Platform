import bcrypt from 'bcryptjs';
import { CandidateModel } from '../candidate/candidate.model';
import { AppError } from '../../shared/errors/app-error';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../shared/utils';
import { getRedisClient } from '../../lib/redis';
import type { RegisterInput, LoginInput } from '../../shared/validators';

const REFRESH_TOKEN_PREFIX = 'refresh:';
const BCRYPT_ROUNDS = 12;

export async function register(input: RegisterInput) {
  const existing = await CandidateModel.findOne({ email: input.email }).lean();
  if (existing) {
    throw AppError.conflict('Email already registered');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await CandidateModel.create({
    email: input.email,
    name: input.name,
    passwordHash,
    role: input.role,
  });

  const payload = { userId: user._id.toString(), email: user.email, role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await storeRefreshToken(user._id.toString(), refreshToken);

  return { accessToken, refreshToken, user: { id: user._id, email: user.email, name: user.name, role: user.role } };
}

export async function login(input: LoginInput) {
  const user = await CandidateModel.findOne({ email: input.email }).select('+passwordHash');
  if (!user) {
    throw AppError.unauthorized('Invalid email or password');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw AppError.unauthorized('Invalid email or password');
  }

  const payload = { userId: user._id.toString(), email: user.email, role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await storeRefreshToken(user._id.toString(), refreshToken);

  return { accessToken, refreshToken, user: { id: user._id, email: user.email, name: user.name, role: user.role } };
}

export async function refresh(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw AppError.unauthorized('Invalid refresh token');
  }

  const stored = await getRedisClient().get(`${REFRESH_TOKEN_PREFIX}${payload.userId}`);
  if (!stored || stored !== refreshToken) {
    throw AppError.unauthorized('Refresh token revoked or invalid');
  }

  const newAccessToken = signAccessToken({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  });
  const newRefreshToken = signRefreshToken({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
  });

  await storeRefreshToken(payload.userId, newRefreshToken);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

export async function logout(userId: string): Promise<void> {
  await getRedisClient().del(`${REFRESH_TOKEN_PREFIX}${userId}`);
}

async function storeRefreshToken(userId: string, token: string): Promise<void> {
  // Store for 7 days in seconds
  await getRedisClient().set(`${REFRESH_TOKEN_PREFIX}${userId}`, token, 'EX', 7 * 24 * 60 * 60);
}
