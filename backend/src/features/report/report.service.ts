import { InterviewSessionModel } from '../interview/interview.model';
import { ScoreModel, SessionScoreMetaModel } from '../scoring/score.model';
import { ReportModel } from './report.model';
import { JobRoleModel } from '../job/job.model';
import { createLLMAdapter } from '../../adapters/llm';
import { AppError } from '../../shared/errors/app-error';
import type { HiringRecommendation, RedFlag, ConsistencyResult } from '../../shared/types';

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

  const [session, scores, scoreMeta] = await Promise.all([
    InterviewSessionModel.findById(sessionId).lean(),
    ScoreModel.find({ sessionId }).lean(),
    SessionScoreMetaModel.findOne({ sessionId }).lean(),
  ]);

  if (!session) throw AppError.notFound('Session not found');

  // --- Aggregate dimension scores (scale 0–10 → 0–100) ---
  const avg = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  const technicalAvg = avg(scores.map(s => s.dimensions.technical));
  const communicationAvg = avg(scores.map(s => s.dimensions.communication));
  const depthAvg = avg(scores.map(s => s.dimensions.depth));
  const relevanceAvg = avg(scores.map(s => s.dimensions.relevance));
  const resumeAlignmentAvg = avg(scores.map(s => s.dimensions.resumeAlignment ?? 5));
  const overallAvg = avg(scores.map(s => s.overallScore));
  const avgConfidence = avg(scores.map(s => s.confidence ?? 0.7));

  const overallScore = Math.round(overallAvg * 10); // 0–100

  const dimensionScores = {
    technical: Math.round(technicalAvg * 10),
    communication: Math.round(communicationAvg * 10),
    problemSolving: Math.round(depthAvg * 10),
    culturalFit: Math.round(relevanceAvg * 10),
    resumeAlignment: Math.round(resumeAlignmentAvg * 10),
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

  // --- Red flags and consistency from scoring meta ---
  const redFlags: RedFlag[] = scoreMeta?.redFlags ?? [];
  const consistency: ConsistencyResult | null = scoreMeta?.consistency ?? null;

  // --- Hiring recommendation ---
  const recommendation = deriveRecommendation(overallScore, antiCheatFlags.length, redFlags, consistency);

  // --- LLM narrative summary ---
  const questionScoreItems = scores.map(s => ({
    questionId: s.questionId,
    questionText: s.questionText,
    score: Math.round(s.overallScore * 10),
    summary: s.reasoning,
    confidence: s.confidence ?? 0.7,
  }));

  const { summary, strengths, weaknesses } = await generateNarrative({
    overallScore,
    dimensionScores,
    questionScores: questionScoreItems,
    recommendation,
    antiCheatFlags,
    redFlags,
    consistency,
    averageConfidence: avgConfidence,
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
    redFlags,
    consistency,
    averageConfidence: avgConfidence,
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

export async function getReportsBySessionIds(sessionIds: string[]) {
  return ReportModel.find({ sessionId: { $in: sessionIds } })
    .populate('candidateId', 'name email')
    .populate('jobRoleId', 'title domain experienceLevel')
    .lean();
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
  redFlags: RedFlag[],
  consistency: ConsistencyResult | null,
): HiringRecommendation {
  // Hard disqualifiers
  if (antiCheatFlagCount >= 2) return 'NO_HIRE';

  const highSeverityRedFlags = redFlags.filter(f => f.severity === 'high').length;
  if (highSeverityRedFlags >= 2) return 'NO_HIRE';

  // Consistency penalty
  const consistencyPenalty = consistency && consistency.consistencyScore < 4 ? 10 : 0;
  const mediumRedFlagPenalty = redFlags.filter(f => f.severity === 'medium').length * 3;
  const adjustedScore = overallScore - consistencyPenalty - mediumRedFlagPenalty;

  if (adjustedScore >= 80) return 'STRONG_HIRE';
  if (adjustedScore >= 65) return 'HIRE';
  if (adjustedScore >= 50) return 'BORDERLINE';
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
  dimensionScores: { technical: number; communication: number; problemSolving: number; culturalFit: number; resumeAlignment: number };
  questionScores: Array<{ questionText: string; score: number; summary: string; confidence: number }>;
  recommendation: HiringRecommendation;
  antiCheatFlags: string[];
  redFlags: RedFlag[];
  consistency: ConsistencyResult | null;
  averageConfidence: number;
}): Promise<{ summary: string; strengths: string[]; weaknesses: string[] }> {
  const llm = createLLMAdapter();

  const scoreSummary = data.questionScores
    .map((q, i) => `Q${i + 1} (${q.score}/100, confidence: ${q.confidence.toFixed(2)}): ${q.summary.slice(0, 150)}`)
    .join('\n');

  const redFlagSummary = data.redFlags.length
    ? `\nRed flags detected:\n${data.redFlags.map(f => `- [${f.severity}] ${f.type}: ${f.description}`).join('\n')}`
    : '';

  const consistencySummary = data.consistency
    ? `\nConsistency score: ${data.consistency.consistencyScore}/10${data.consistency.contradictions.length ? `\nContradictions: ${data.consistency.contradictions.join('; ')}` : ''}`
    : '';

  const prompt = `You are a hiring manager writing an interview evaluation report.

Overall Score: ${data.overallScore}/100
Recommendation: ${data.recommendation}
Average Scoring Confidence: ${data.averageConfidence.toFixed(2)}
Technical: ${data.dimensionScores.technical}/100
Communication: ${data.dimensionScores.communication}/100
Problem Solving: ${data.dimensionScores.problemSolving}/100
Cultural Fit: ${data.dimensionScores.culturalFit}/100
Resume Alignment: ${data.dimensionScores.resumeAlignment}/100

Question-by-question scores:
${scoreSummary}

${data.antiCheatFlags.length ? `Anti-cheat flags: ${data.antiCheatFlags.join(', ')}` : ''}
${redFlagSummary}
${consistencySummary}

Return ONLY valid JSON:
{
  "summary": "3-4 sentence narrative evaluation of the candidate, including any red flags or consistency concerns",
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
