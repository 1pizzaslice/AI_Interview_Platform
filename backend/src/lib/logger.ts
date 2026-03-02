import pino from 'pino';
import { config } from '../config';
import { randomUUID } from 'crypto';

const logLevel = (process.env.LOG_LEVEL ?? (config.NODE_ENV === 'production' ? 'info' : 'debug')) as pino.Level;

export const logger = pino({
  level: logLevel,
  ...(config.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } }
    : {}),
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  base: { service: 'ai-interview-backend' },
});

export function createRequestId(): string {
  return randomUUID().slice(0, 8);
}

export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
