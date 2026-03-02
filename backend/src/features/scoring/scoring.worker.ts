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
import { logger } from '../../lib/logger';
import type { ScoreSessionJobData } from './scoring.queue';

async function bootstrap(): Promise<void> {
  await connectDB();
  await connectRedis();

  const worker = new Worker<ScoreSessionJobData>(
    SCORING_QUEUE_NAME,
    async (job) => {
      const { sessionId } = job.data;
      logger.info({ sessionId }, 'Processing scoring job');

      await scoreSession(sessionId);
      logger.info({ sessionId }, 'Scoring complete');

      await generateReport(sessionId);
      logger.info({ sessionId }, 'Report generated');

      await InterviewSessionModel.findByIdAndUpdate(sessionId, {
        $set: { currentState: 'DONE' },
      });
      logger.info({ sessionId }, 'Session marked DONE');
    },
    {
      connection: getRedisClient() as never,
      concurrency: 5,
    },
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Scoring job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err: err.message }, 'Scoring job failed');
  });

  logger.info('Scoring worker listening for jobs');
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Fatal scoring worker startup error');
  process.exit(1);
});
