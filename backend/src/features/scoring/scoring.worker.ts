/**
 * Scoring Worker — run as a separate process:
 *   npm run worker
 *
 * Processes BullMQ jobs from the 'scoring' queue.
 * On completion, triggers report generation and marks session DONE.
 */
import 'dotenv/config';
import { Worker } from 'bullmq';
import { connectDB } from '../../lib/db';
import { connectRedis, getRedisClient } from '../../lib/redis';
import { SCORING_QUEUE_NAME } from '../../lib/queue';
import { scoreSession } from './scoring.service';
import { generateReport } from '../report/report.service';
import { InterviewSessionModel } from '../interview/interview.model';
import type { ScoreSessionJobData } from './scoring.queue';

async function bootstrap(): Promise<void> {
  await connectDB();
  await connectRedis();

  const worker = new Worker<ScoreSessionJobData>(
    SCORING_QUEUE_NAME,
    async (job) => {
      const { sessionId } = job.data;
      console.log(`[ScoringWorker] Processing session ${sessionId}`);

      await scoreSession(sessionId);
      console.log(`[ScoringWorker] Scoring complete for ${sessionId}`);

      await generateReport(sessionId);
      console.log(`[ScoringWorker] Report generated for ${sessionId}`);

      await InterviewSessionModel.findByIdAndUpdate(sessionId, {
        $set: { currentState: 'DONE' },
      });
      console.log(`[ScoringWorker] Session ${sessionId} marked DONE`);
    },
    {
      connection: getRedisClient(),
      concurrency: 5,
    },
  );

  worker.on('completed', (job) => {
    console.log(`[ScoringWorker] Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[ScoringWorker] Job ${job?.id} failed:`, err.message);
  });

  console.log('[ScoringWorker] Listening for scoring jobs...');
}

bootstrap().catch((err) => {
  console.error('[ScoringWorker] Fatal startup error:', err);
  process.exit(1);
});
