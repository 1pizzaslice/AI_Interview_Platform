import http from 'http';
import { WebSocketServer } from 'ws';
import * as Sentry from '@sentry/node';
import { config } from './config';
import { connectDB } from './lib/db';
import { connectRedis } from './lib/redis';
import { createApp } from './app';
import { setupInterviewGateway } from './features/interview/interview.gateway';
import { logger } from './lib/logger';

// Initialize Sentry early (before anything else)
if (config.SENTRY_DSN) {
  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    tracesSampleRate: config.NODE_ENV === 'production' ? 0.2 : 1.0,
  });
  logger.info('Sentry initialized');
}

async function bootstrap(): Promise<void> {
  // Connect to MongoDB and Redis before accepting traffic
  await connectDB();
  await connectRedis();

  const app = createApp();
  const server = http.createServer(app);

  // Attach WebSocket server to the same HTTP server, path-filtered
  const wss = new WebSocketServer({ server, path: '/interview' });
  setupInterviewGateway(wss);
  logger.info('Interview gateway listening at /interview');

  server.listen(config.PORT, () => {
    logger.info({ port: config.PORT, env: config.NODE_ENV }, 'Server running');
    logger.info({
      llm: config.LLM_PROVIDER,
      stt: config.STT_PROVIDER,
      tts: config.TTS_PROVIDER,
      storage: config.STORAGE_PROVIDER,
    }, 'Adapter configuration');
  });

  // --- Graceful shutdown ---
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received');
    server.close(async () => {
      const { disconnectDB } = await import('./lib/db');
      const { disconnectRedis } = await import('./lib/redis');
      await Promise.all([disconnectDB(), disconnectRedis()]);
      logger.info('Shutdown complete');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error('Force exit after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'Unhandled rejection');
  });
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Fatal startup error');
  process.exit(1);
});
