import Redis from 'ioredis';
import { config } from '../config';
import { logger } from './logger';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      logger.info('[Redis] Connected');
    });

    redisClient.on('error', (err: Error) => {
      logger.error({ err }, '[Redis] Error');
    });

    redisClient.on('close', () => {
      logger.warn('[Redis] Connection closed');
    });
  }

  return redisClient;
}

export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  await client.connect();
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('[Redis] Disconnected gracefully');
  }
}
