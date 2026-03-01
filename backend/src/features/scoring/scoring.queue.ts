import { getScoringQueue } from '../../lib/queue';

export interface ScoreSessionJobData {
  sessionId: string;
}

export async function enqueueScoreSession(sessionId: string): Promise<void> {
  const queue = getScoringQueue();
  await queue.add('score-session', { sessionId } satisfies ScoreSessionJobData, {
    jobId: `score-${sessionId}`, // deduplicate — one scoring job per session
  });
}
