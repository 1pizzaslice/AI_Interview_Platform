import { InterviewSessionModel } from '../interview/interview.model';
import { ScoreModel, SessionScoreMetaModel } from './score.model';
import { CandidateModel } from '../candidate/candidate.model';
import { createLLMAdapter } from '../../adapters/llm';
import { AppError } from '../../shared/errors/app-error';
import type { ScoreDimensions, RedFlag, ConsistencyResult } from '../../shared/types';
import { logger } from '../../lib/logger';

interface ScoredAnswer {
  questionId: string;
  questionText: string;
  answerText: string;
  overallScore: number;
  dimensions: ScoreDimensions;
  reasoning: string;
  confidence: number;
}

export async function scoreSession(sessionId: string): Promise<void> {
  const session = await InterviewSessionModel.findById(sessionId).lean();
  if (!session) throw AppError.notFound('Session not found');

  // Fetch parsed resume for resume verification scoring
  const candidate = await CandidateModel.findById(session.candidateId).lean();
  const resumeSummary = candidate?.parsedResume?.summary ?? '';
  const resumeSkills = candidate?.parsedResume?.skills ?? [];

  // Delete any previously computed scores for this session (idempotent retry)
  await Promise.all([
    ScoreModel.deleteMany({ sessionId }),
    SessionScoreMetaModel.deleteOne({ sessionId }),
  ]);

  // Pair each generated question with the candidate's answer from the transcript.
  const scoringPairs = session.generatedQuestions.map((q, i) => {
    const topicState = `TOPIC_${i + 1}`;
    const topicAnswers = session.transcript.filter(
      e => e.speaker === 'candidate' && e.state === topicState,
    );
    const answer = topicAnswers.at(-1)?.text ?? '[No answer provided]';
    const responseTimeMs = topicAnswers.at(-1)?.responseTimeMs ?? null;
    return { question: q, answer, responseTimeMs };
  });

  // Score each answer individually (with resume verification + confidence)
  const scoredAnswers = await Promise.all(
    scoringPairs.map(({ question, answer }) =>
      scoreOneAnswer(question, answer, resumeSummary, resumeSkills),
    ),
  );

  await ScoreModel.insertMany(
    scoredAnswers.map(s => ({ ...s, sessionId })),
  );

  // Cross-answer consistency scoring (second pass)
  const consistency = await scoreConsistency(scoredAnswers, resumeSummary);

  // Red flag detection (third pass)
  const redFlags = await detectRedFlags(
    scoredAnswers,
    scoringPairs.map(p => p.responseTimeMs),
    session.transcript,
    resumeSummary,
  );

  await SessionScoreMetaModel.create({
    sessionId,
    consistency,
    redFlags,
  });
}

export async function getScoresForSession(sessionId: string) {
  return ScoreModel.find({ sessionId }).lean();
}

export async function getScoreMetaForSession(sessionId: string) {
  return SessionScoreMetaModel.findOne({ sessionId }).lean();
}

async function scoreOneAnswer(
  question: { id: string; text: string; topicArea: string; difficulty: string },
  answerText: string,
  resumeSummary: string,
  resumeSkills: string[],
): Promise<ScoredAnswer> {
  const llm = createLLMAdapter();

  const prompt = `You are an expert technical interviewer scoring a candidate's answer.

Question (${question.difficulty} difficulty, topic: ${question.topicArea}):
"${question.text}"

Candidate's Answer:
"${answerText}"

Candidate's Resume Summary: "${resumeSummary.slice(0, 300)}"
Candidate's Resume Skills: ${resumeSkills.slice(0, 15).join(', ')}

Score the answer on a scale of 0-10 for each dimension and provide an overall score.
Return ONLY valid JSON in this exact format:
{
  "overallScore": 7,
  "dimensions": {
    "technical": 8,
    "communication": 7,
    "depth": 6,
    "relevance": 8,
    "resumeAlignment": 7,
    "confidence": 0.85
  },
  "reasoning": "One paragraph explaining the score.",
  "confidence": 0.85
}

Scoring guide:
- technical: accuracy and correctness of technical content (0-10)
- communication: clarity and structure of the answer (0-10)
- depth: thoroughness and detail provided (0-10)
- relevance: how well the answer addresses what was asked (0-10)
- resumeAlignment: does the answer substantiate or contradict resume claims? 0=contradiction, 5=neutral, 10=strong validation (0-10)
- confidence (in dimensions): how certain you are about the resumeAlignment score (0.0-1.0)
- overallScore: holistic assessment (not just an average)
- confidence (top-level): how certain you are about the overall assessment. 0.9+=clearly strong/weak, 0.5-0.8=ambiguous, <0.5=uncertain`;

  const response = await llm.complete(
    [
      { role: 'system', content: 'You are a technical interviewer scoring answers. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ],
    { maxTokens: 512, temperature: 0 },
  );

  try {
    const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned) as {
      overallScore: number;
      dimensions: ScoreDimensions;
      reasoning: string;
      confidence: number;
    };
    return {
      questionId: question.id,
      questionText: question.text,
      answerText,
      overallScore: clamp(parsed.overallScore, 0, 10),
      dimensions: {
        technical: clamp(parsed.dimensions.technical, 0, 10),
        communication: clamp(parsed.dimensions.communication, 0, 10),
        depth: clamp(parsed.dimensions.depth, 0, 10),
        relevance: clamp(parsed.dimensions.relevance, 0, 10),
        resumeAlignment: clamp(parsed.dimensions.resumeAlignment ?? 5, 0, 10),
        confidence: clamp(parsed.dimensions.confidence ?? 0.7, 0, 1),
      },
      reasoning: parsed.reasoning,
      confidence: clamp(parsed.confidence ?? 0.7, 0, 1),
    };
  } catch {
    logger.error({ response: response.slice(0, 200) }, 'Failed to parse LLM score response');
    return {
      questionId: question.id,
      questionText: question.text,
      answerText,
      overallScore: 5,
      dimensions: { technical: 5, communication: 5, depth: 5, relevance: 5, resumeAlignment: 5, confidence: 0.3 },
      reasoning: 'Scoring could not be completed automatically.',
      confidence: 0.3,
    };
  }
}

async function scoreConsistency(
  scoredAnswers: ScoredAnswer[],
  resumeSummary: string,
): Promise<ConsistencyResult> {
  const llm = createLLMAdapter();

  const answerSummaries = scoredAnswers.map((a, i) =>
    `Q${i + 1} ("${a.questionText.slice(0, 80)}"): "${a.answerText.slice(0, 200)}" [Score: ${a.overallScore}/10]`,
  ).join('\n');

  const prompt = `Review all of this candidate's interview answers together for consistency.

${answerSummaries}

Resume summary: "${resumeSummary.slice(0, 300)}"

Check for:
1. Contradictions between answers (e.g., claims different years of experience in different answers)
2. Inconsistent depth/specificity across similar topics (detailed in one area, vague in related area)
3. Claims that conflict with resume data
4. Fabrication signals (overly specific numbers, inconsistent technical details)

Return ONLY valid JSON:
{
  "consistencyScore": 8,
  "contradictions": ["specific contradiction if any"],
  "flags": ["any notable consistency observations"]
}

consistencyScore: 0=highly inconsistent/suspicious, 5=some inconsistencies, 10=fully consistent.
Return empty arrays if no issues found.`;

  try {
    const response = await llm.complete([
      { role: 'system', content: 'You are an expert evaluator checking answer consistency. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ], { maxTokens: 400, temperature: 0 });

    const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned) as ConsistencyResult;
    return {
      consistencyScore: clamp(parsed.consistencyScore ?? 7, 0, 10),
      contradictions: parsed.contradictions ?? [],
      flags: parsed.flags ?? [],
    };
  } catch {
    return { consistencyScore: 7, contradictions: [], flags: ['Consistency analysis could not be completed'] };
  }
}

async function detectRedFlags(
  scoredAnswers: ScoredAnswer[],
  responseTimes: (number | null)[],
  _transcript: Array<{ speaker: string; text: string; state: string; responseTimeMs?: number | null }>,
  resumeSummary: string,
): Promise<RedFlag[]> {
  const llm = createLLMAdapter();
  const flags: RedFlag[] = [];

  // 1. Timing anomaly analysis
  const validTimes = responseTimes.filter((t): t is number => t !== null && t > 0);
  if (validTimes.length >= 2) {
    // Suspiciously fast responses for technical questions (< 3s)
    const fastResponses = validTimes.filter(t => t < 3000);
    if (fastResponses.length > 0) {
      flags.push({
        type: 'timing_anomaly',
        severity: fastResponses.length >= 2 ? 'high' : 'medium',
        description: `${fastResponses.length} answer(s) submitted in under 3 seconds for technical questions`,
        evidence: `Response times: ${fastResponses.map(t => `${(t / 1000).toFixed(1)}s`).join(', ')}`,
      });
    }

    // Highly consistent timing (robotic pattern)
    const avg = validTimes.reduce((a, b) => a + b, 0) / validTimes.length;
    const stdDev = Math.sqrt(validTimes.reduce((sum, t) => sum + (t - avg) ** 2, 0) / validTimes.length);
    const coefficientOfVariation = stdDev / avg;
    if (coefficientOfVariation < 0.1 && validTimes.length >= 3) {
      flags.push({
        type: 'timing_anomaly',
        severity: 'medium',
        description: 'Response times are suspiciously consistent across questions (robotic pattern)',
        evidence: `CV: ${(coefficientOfVariation * 100).toFixed(1)}%, avg: ${(avg / 1000).toFixed(1)}s`,
      });
    }
  }

  // 2. AI-generated and memorized answer detection via LLM
  const answerSummaries = scoredAnswers.map((a, i) =>
    `Q${i + 1}: "${a.answerText.slice(0, 250)}"`,
  ).join('\n\n');

  const prompt = `Analyze these interview answers for signs of AI-generated or memorized responses.

${answerSummaries}

Resume context: "${resumeSummary.slice(0, 200)}"

For EACH answer, assess:
1. AI-generated probability: Is it overly structured? Lacks personal anecdotes? Unusual vocabulary consistency? Uses templated phrases?
2. Memorized answer probability: Generic? Doesn't build on conversation context? Sounds rehearsed?
3. Resume contradiction: Does the answer conflict with resume claims?

Return ONLY valid JSON array (one entry per flagged answer, empty array if no flags):
[
  {
    "type": "ai_generated" | "memorized_answer" | "resume_contradiction",
    "severity": "low" | "medium" | "high",
    "description": "what was detected",
    "evidence": "specific text or pattern that triggered the flag"
  }
]

Only flag answers where you have medium-high confidence. Do NOT flag every answer.`;

  try {
    const response = await llm.complete([
      { role: 'system', content: 'You are an academic integrity analyst. Return only valid JSON array.' },
      { role: 'user', content: prompt },
    ], { maxTokens: 500, temperature: 0 });

    const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
    const llmFlags = JSON.parse(cleaned) as RedFlag[];
    if (Array.isArray(llmFlags)) {
      flags.push(...llmFlags.filter(f => f.type && f.severity && f.description));
    }
  } catch {
    // LLM red flag detection failed — timing flags still included
  }

  return flags;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
