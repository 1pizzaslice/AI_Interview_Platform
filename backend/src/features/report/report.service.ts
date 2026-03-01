import { InterviewSessionModel } from '../interview/interview.model';
import { ScoreModel } from '../scoring/score.model';
import { ReportModel } from './report.model';
import { JobRoleModel } from '../job/job.model';
import { createLLMAdapter } from '../../adapters/llm';
import { AppError } from '../../shared/errors/app-error';
import type { HiringRecommendation } from '../../shared/types';

const ANTI_CHEAT_FLAG_THRESHOLDS: Record<string, number> = {
  TAB_SWITCH: 3,
  WINDOW_BLUR: 3,
  GAZE_LOST: 5,
  COPY_PASTE: 1,
  MULTIPLE_FACES: 1,
};

export async function generateReport(sessionId: string): Promise<void> {
  // Idempotent — delete and regenerate if it exists
  await ReportModel.deleteOne({ sessionId });

  const [session, scores] = await Promise.all([
    InterviewSessionModel.findById(sessionId).lean(),
    ScoreModel.find({ sessionId }).lean(),
  ]);

  if (!session) throw AppError.notFound('Session not found');

  // --- Aggregate dimension scores (scale 0–10 → 0–100) ---
  const avg = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  const technicalAvg = avg(scores.map(s => s.dimensions.technical));
  const communicationAvg = avg(scores.map(s => s.dimensions.communication));
  const depthAvg = avg(scores.map(s => s.dimensions.depth));
  const relevanceAvg = avg(scores.map(s => s.dimensions.relevance));
  const overallAvg = avg(scores.map(s => s.overallScore));

  const overallScore = Math.round(overallAvg * 10); // 0–100

  const dimensionScores = {
    technical: Math.round(technicalAvg * 10),
    communication: Math.round(communicationAvg * 10),
    problemSolving: Math.round(depthAvg * 10),
    culturalFit: Math.round(relevanceAvg * 10),
  };

  // --- Anti-cheat flags ---
  const eventCounts: Record<string, number> = {};
  for (const event of session.antiCheatEvents) {
    eventCounts[event.type] = (eventCounts[event.type] ?? 0) + 1;
  }

  const antiCheatFlags: string[] = [];
  for (const [type, count] of Object.entries(eventCounts)) {
    const threshold = ANTI_CHEAT_FLAG_THRESHOLDS[type] ?? 1;
    if (count >= threshold) {
      antiCheatFlags.push(formatAntiCheatFlag(type, count));
    }
  }

  // --- Hiring recommendation ---
  const recommendation = deriveRecommendation(overallScore, antiCheatFlags.length);

  // --- LLM narrative summary ---
  const questionScoreItems = scores.map(s => ({
    questionId: s.questionId,
    questionText: s.questionText,
    score: Math.round(s.overallScore * 10),
    summary: s.reasoning,
  }));

  const { summary, strengths, weaknesses } = await generateNarrative({
    overallScore,
    dimensionScores,
    questionScores: questionScoreItems,
    recommendation,
    antiCheatFlags,
  });

  await ReportModel.create({
    sessionId,
    candidateId: session.candidateId,
    jobRoleId: session.jobRoleId,
    overallScore,
    dimensionScores,
    strengths,
    weaknesses,
    recommendation,
    summary,
    antiCheatFlags,
    questionScores: questionScoreItems,
    generatedAt: new Date(),
  });
}

export async function getReportBySession(sessionId: string) {
  const report = await ReportModel.findOne({ sessionId })
    .populate('candidateId', 'name email')
    .populate('jobRoleId', 'title domain experienceLevel')
    .lean();
  if (!report) throw AppError.notFound('Report not found. Scoring may still be in progress.');
  return report;
}

export async function listReportsForRecruiter(recruiterId: string) {
  const jobs = await JobRoleModel.find({ recruiterId }, '_id').lean();
  const jobIds = jobs.map(j => j._id);
  return ReportModel.find({ jobRoleId: { $in: jobIds } })
    .populate('candidateId', 'name email')
    .populate('jobRoleId', 'title domain')
    .sort({ generatedAt: -1 })
    .lean();
}

// --- Private helpers ---

function deriveRecommendation(
  overallScore: number,
  antiCheatFlagCount: number,
): HiringRecommendation {
  if (antiCheatFlagCount >= 2) return 'NO_HIRE';
  if (overallScore >= 80) return 'STRONG_HIRE';
  if (overallScore >= 65) return 'HIRE';
  if (overallScore >= 50) return 'BORDERLINE';
  return 'NO_HIRE';
}

function formatAntiCheatFlag(type: string, count: number): string {
  const labels: Record<string, string> = {
    TAB_SWITCH: 'switched tabs',
    WINDOW_BLUR: 'left the window',
    GAZE_LOST: 'looked away from screen',
    COPY_PASTE: 'used copy-paste',
    MULTIPLE_FACES: 'multiple faces detected',
  };
  return `Candidate ${labels[type] ?? type} ${count} time(s)`;
}

async function generateNarrative(data: {
  overallScore: number;
  dimensionScores: { technical: number; communication: number; problemSolving: number; culturalFit: number };
  questionScores: Array<{ questionText: string; score: number; summary: string }>;
  recommendation: HiringRecommendation;
  antiCheatFlags: string[];
}): Promise<{ summary: string; strengths: string[]; weaknesses: string[] }> {
  const llm = createLLMAdapter();

  const scoreSummary = data.questionScores
    .map((q, i) => `Q${i + 1} (${q.score}/100): ${q.summary.slice(0, 150)}`)
    .join('\n');

  const prompt = `You are a hiring manager writing an interview evaluation report.

Overall Score: ${data.overallScore}/100
Recommendation: ${data.recommendation}
Technical: ${data.dimensionScores.technical}/100
Communication: ${data.dimensionScores.communication}/100
Problem Solving: ${data.dimensionScores.problemSolving}/100
Cultural Fit: ${data.dimensionScores.culturalFit}/100

Question-by-question scores:
${scoreSummary}

${data.antiCheatFlags.length ? `Anti-cheat flags: ${data.antiCheatFlags.join(', ')}` : ''}

Return ONLY valid JSON:
{
  "summary": "3-4 sentence narrative evaluation of the candidate",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"]
}`;

  const response = await llm.complete(
    [
      { role: 'system', content: 'You are a hiring manager writing evaluation reports. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    { maxTokens: 600, temperature: 0.5 },
  );

  try {
    const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned) as { summary: string; strengths: string[]; weaknesses: string[] };
  } catch {
    return {
      summary: `The candidate scored ${data.overallScore}/100 overall with a recommendation of ${data.recommendation}.`,
      strengths: ['Completed the interview'],
      weaknesses: ['Report narrative generation failed — review scores manually'],
    };
  }
}
