import { Queue } from 'bullmq';
import { getRedisClient } from './redis';

export const SCORING_QUEUE_NAME = 'scoring';

let scoringQueue: Queue | null = null;

export function getScoringQueue(): Queue {
  if (!scoringQueue) {
    scoringQueue = new Queue(SCORING_QUEUE_NAME, {
      connection: getRedisClient() as never,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    });
  }
  return scoringQueue;
}
