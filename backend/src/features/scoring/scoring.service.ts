import { InterviewSessionModel } from '../interview/interview.model';
import { ScoreModel } from './score.model';
import { createLLMAdapter } from '../../adapters/llm';
import { AppError } from '../../shared/errors/app-error';
import type { ScoreDimensions } from '../../shared/types';

interface ScoredAnswer {
  questionId: string;
  questionText: string;
  answerText: string;
  overallScore: number;
  dimensions: ScoreDimensions;
  reasoning: string;
}

export async function scoreSession(sessionId: string): Promise<void> {
  const session = await InterviewSessionModel.findById(sessionId).lean();
  if (!session) throw AppError.notFound('Session not found');

  // Delete any previously computed scores for this session (idempotent retry)
  await ScoreModel.deleteMany({ sessionId });

  // Pair each generated question with the candidate's answer from the transcript.
  // Only consider answers given during TOPIC_N states — warmup/wrap-up answers
  // are excluded so they don't shift the index and mismatch with questions.
  const scoringPairs = session.generatedQuestions.map((q, i) => {
    const topicState = `TOPIC_${i + 1}`;
    // Take the last candidate answer in that topic state (covers follow-up answers)
    const topicAnswers = session.transcript.filter(
      e => e.speaker === 'candidate' && e.state === topicState,
    );
    const answer = topicAnswers.at(-1)?.text ?? '[No answer provided]';
    return { question: q, answer };
  });

  const scoredAnswers = await Promise.all(
    scoringPairs.map(({ question, answer }) => scoreOneAnswer(question, answer)),
  );

  await ScoreModel.insertMany(
    scoredAnswers.map(s => ({ ...s, sessionId })),
  );
}

export async function getScoresForSession(sessionId: string): Promise<IScore[]> {
  return ScoreModel.find({ sessionId }).lean() as Promise<IScore[]>;
}

async function scoreOneAnswer(
  question: { id: string; text: string; topicArea: string; difficulty: string },
  answerText: string,
): Promise<ScoredAnswer> {
  const llm = createLLMAdapter();

  const prompt = `You are an expert technical interviewer scoring a candidate's answer.

Question (${question.difficulty} difficulty, topic: ${question.topicArea}):
"${question.text}"

Candidate's Answer:
"${answerText}"

Score the answer on a scale of 0-10 for each dimension and provide an overall score.
Return ONLY valid JSON in this exact format:
{
  "overallScore": 7,
  "dimensions": {
    "technical": 8,
    "communication": 7,
    "depth": 6,
    "relevance": 8
  },
  "reasoning": "One paragraph explaining the score."
}

Scoring guide:
- technical: accuracy and correctness of technical content
- communication: clarity and structure of the answer
- depth: thoroughness and detail provided
- relevance: how well the answer addresses what was asked
- overallScore: holistic assessment (not just an average)`;

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
      },
      reasoning: parsed.reasoning,
    };
  } catch {
    console.error('[Scoring] Failed to parse LLM score response:', response.slice(0, 200));
    return {
      questionId: question.id,
      questionText: question.text,
      answerText,
      overallScore: 5,
      dimensions: { technical: 5, communication: 5, depth: 5, relevance: 5 },
      reasoning: 'Scoring could not be completed automatically.',
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Re-export for worker use
type IScore = import('./score.model').IScore;
