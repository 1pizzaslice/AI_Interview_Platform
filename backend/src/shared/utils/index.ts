import jwt from 'jsonwebtoken';
import type { AuthPayload } from '../types';
import { config } from '../../config';

export function signAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function signRefreshToken(payload: AuthPayload): string {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AuthPayload {
  return jwt.verify(token, config.JWT_SECRET) as AuthPayload;
}

export function verifyRefreshToken(token: string): AuthPayload {
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as AuthPayload;
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

/**
 * Strip markdown and emojis from text before sending to TTS.
 * Keeps the original text intact for chat display.
 */
export function sanitizeForTTS(text: string): string {
  return text
    // Remove emojis (covers most Unicode emoji ranges)
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, '')
    // Bold / italic: **text** or __text__ or *text* or _text_
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // Inline code and code blocks
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`(.+?)`/g, '$1')
    // Headings: # ## ###
    .replace(/^#{1,6}\s+/gm, '')
    // Blockquotes
    .replace(/^>\s+/gm, '')
    // Horizontal rules
    .replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '')
    // Unordered list markers (- * +)
    .replace(/^[\s]*[-*+]\s+/gm, '')
    // Ordered list markers (1. 2.)
    .replace(/^[\s]*\d+\.\s+/gm, '')
    // Links: [text](url) → text
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    // Collapse multiple blank lines / leading-trailing whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
