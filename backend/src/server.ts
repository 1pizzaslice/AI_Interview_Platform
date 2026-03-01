import http from 'http';
import { WebSocketServer } from 'ws';
import { config } from './config';
import { connectDB } from './lib/db';
import { connectRedis } from './lib/redis';
import { createApp } from './app';
import { setupInterviewGateway } from './features/interview/interview.gateway';

async function bootstrap(): Promise<void> {
  // Connect to MongoDB and Redis before accepting traffic
  await connectDB();
  await connectRedis();

  const app = createApp();
  const server = http.createServer(app);

  // Attach WebSocket server to the same HTTP server, path-filtered
  const wss = new WebSocketServer({ server, path: '/interview' });
  setupInterviewGateway(wss);
  console.log('[WS] Interview gateway listening at /interview');

  server.listen(config.PORT, () => {
    console.log(`[Server] Running on port ${config.PORT} (${config.NODE_ENV})`);
    console.log(`[Server] LLM=${config.LLM_PROVIDER} STT=${config.STT_PROVIDER} TTS=${config.TTS_PROVIDER} Storage=${config.STORAGE_PROVIDER}`);
  });

  // --- Graceful shutdown ---
  const shutdown = async (signal: string) => {
    console.log(`\n[Server] ${signal} received — shutting down gracefully`);
    server.close(async () => {
      const { disconnectDB } = await import('./lib/db');
      const { disconnectRedis } = await import('./lib/redis');
      await Promise.all([disconnectDB(), disconnectRedis()]);
      console.log('[Server] Shutdown complete');
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      console.error('[Server] Force exit after timeout');
      process.exit(1);
    }, 10_000);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    console.error('[Server] Unhandled rejection:', reason);
  });
}

bootstrap().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
