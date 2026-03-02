import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { InterviewSessionModel } from './interview.model';
import { JobRoleModel } from '../job/job.model';
import { CandidateModel } from '../candidate/candidate.model';
import { AppError } from '../../shared/errors/app-error';
import { createLLMAdapter } from '../../adapters/llm';
import { getScoringQueue } from '../../lib/queue';
import type { Question, TranscriptEntry, AntiCheatEvent, InterviewState, AnswerEvaluation, PerformanceSnapshot } from '../../shared/types';
import {
  transition,
  isTerminalState,
  getCurrentTopicNumber,
  isTopicState,
  type StateMachineContext,
} from './interview.state-machine';
import {
  buildSystemPrompt,
  buildConversationHistory,
  buildEvaluationPrompt,
  buildTransitionPrompt,
  buildFollowUpPrompt,
  buildWarmupPrompt,
  type PersonaContext,
} from './interview.persona';
import { logger } from '../../lib/logger';
import { getQuestionsForJob } from '../question-bank/question-bank.service';

// Defaults — overridden by job's interviewConfig if set
const DEFAULT_MAX_FOLLOW_UPS = 2;
const DEFAULT_WARMUP_QUESTIONS = 2;
const DEFAULT_MAX_TOPICS = 5;

function getSessionConfig(session: { interviewConfig?: { maxFollowUps?: number; warmupQuestions?: number; maxTopics?: number } | null }) {
  return {
    maxFollowUps: session.interviewConfig?.maxFollowUps ?? DEFAULT_MAX_FOLLOW_UPS,
    warmupQuestions: session.interviewConfig?.warmupQuestions ?? DEFAULT_WARMUP_QUESTIONS,
    maxTopics: session.interviewConfig?.maxTopics ?? DEFAULT_MAX_TOPICS,
  };
}

// --- Session lifecycle ---

export async function createSession(candidateId: string, jobRoleId: string) {
  if (!mongoose.isValidObjectId(jobRoleId)) throw AppError.badRequest('Invalid jobRoleId');

  const [candidate, job] = await Promise.all([
    CandidateModel.findById(candidateId).lean(),
    JobRoleModel.findById(jobRoleId).lean(),
  ]);

  if (!candidate) throw AppError.notFound('Candidate not found');
  if (!job || !job.isActive) throw AppError.notFound('Job not found or inactive');

  // Hybrid mode: use custom question bank if available, LLM fills remaining topics
  const customQuestions = await getQuestionsForJob(jobRoleId);
  let questions: Question[];

  if (customQuestions && customQuestions.length > 0) {
    // Convert custom bank questions to Question format
    const bankQuestions: Question[] = customQuestions.map((q, i) => ({
      id: `q${i + 1}`,
      topicArea: q.topicArea,
      text: q.text,
      followUpPrompts: q.followUpPrompts.length > 0
        ? q.followUpPrompts
        : ['Can you give me a specific example?', 'What challenges did you face?'],
      difficulty: q.difficulty,
    }));

    // Check which topic areas are covered by the bank
    const coveredTopics = new Set(bankQuestions.map(q => q.topicArea.toLowerCase()));
    const uncoveredTopics = job.topicAreas.filter(t => !coveredTopics.has(t.toLowerCase()));

    if (uncoveredTopics.length > 0) {
      // Generate LLM questions for uncovered topics
      const llmQuestions = await generateQuestions(
        candidate.parsedResume,
        { title: job.title, description: job.description, requiredSkills: job.requiredSkills, topicAreas: uncoveredTopics, experienceLevel: job.experienceLevel },
      );
      questions = [...bankQuestions, ...llmQuestions].map((q, i) => ({ ...q, id: `q${i + 1}` }));
    } else {
      questions = bankQuestions;
    }
  } else {
    questions = await generateQuestions(
      candidate.parsedResume,
      { title: job.title, description: job.description, requiredSkills: job.requiredSkills, topicAreas: job.topicAreas, experienceLevel: job.experienceLevel },
    );
  }

  // Snapshot interview config from job
  const interviewConfig = job.interviewConfig ? {
    maxTopics: job.interviewConfig.maxTopics,
    warmupQuestions: job.interviewConfig.warmupQuestions,
    maxFollowUps: job.interviewConfig.maxFollowUps,
    estimatedDurationMinutes: job.interviewConfig.estimatedDurationMinutes,
  } : null;

  // Limit questions to maxTopics
  const maxTopics = interviewConfig?.maxTopics ?? DEFAULT_MAX_TOPICS;
  const finalQuestions = questions.slice(0, maxTopics);

  const session = await InterviewSessionModel.create({
    candidateId,
    jobRoleId,
    currentState: 'INTRO',
    status: 'SCHEDULED',
    generatedQuestions: finalQuestions,
    interviewConfig,
  });

  return session;
}

export async function getSession(sessionId: string) {
  if (!mongoose.isValidObjectId(sessionId)) throw AppError.notFound('Session not found');
  const session = await InterviewSessionModel.findById(sessionId).lean();
  if (!session) throw AppError.notFound('Session not found');
  return session;
}

export async function listMySessions(candidateId: string) {
  return InterviewSessionModel.find({ candidateId }).sort({ createdAt: -1 }).lean();
}

export async function listSessionsForJob(jobId: string, recruiterId: string) {
  if (!mongoose.isValidObjectId(jobId)) throw AppError.notFound('Job not found');
  const job = await JobRoleModel.findOne({ _id: jobId, recruiterId }).lean();
  if (!job) throw AppError.forbidden('Not authorized to view these sessions');
  return InterviewSessionModel.find({ jobRoleId: jobId }).sort({ createdAt: -1 }).lean();
}

export async function startSession(sessionId: string, candidateId: string) {
  const session = await InterviewSessionModel.findOne({ _id: sessionId, candidateId });
  if (!session) throw AppError.notFound('Session not found');
  if (session.status !== 'SCHEDULED') throw AppError.badRequest('Session already started or finished');

  session.status = 'IN_PROGRESS';
  session.startedAt = new Date();
  await session.save();
  return session;
}

export async function getIntroMessage(sessionId: string): Promise<string> {
  const session = await InterviewSessionModel.findById(sessionId)
    .populate('candidateId', 'name')
    .lean();

  const candidateName = (session?.candidateId as { name?: string })?.name;
  const greeting = candidateName ? `Hi ${candidateName}!` : 'Hello!';

  return `${greeting} I'm Alex, your interviewer today. We'll have a conversation about your background and technical experience — it should take about 30 to 45 minutes. There are no trick questions here, just a natural conversation. Feel free to take your time with answers. When you're ready to begin, just say "ready".`;
}

export async function processAnswer(
  sessionId: string,
  candidateId: string,
  answerText: string,
  responseTimeMs?: number | null,
): Promise<{
  nextState: InterviewState;
  aiMessage: string;
  transcriptEntry: TranscriptEntry;
  stateChanged: boolean;
  isComplete: boolean;
}> {
  const session = await InterviewSessionModel.findOne({ _id: sessionId, candidateId })
    .populate('candidateId', 'name parsedResume')
    .populate('jobRoleId', 'title experienceLevel');
  if (!session) throw AppError.notFound('Session not found');
  if (isTerminalState(session.currentState as InterviewState)) {
    throw AppError.badRequest('Interview is already complete');
  }

  // Build persona context from populated fields
  const candidateDoc = session.candidateId as unknown as { name: string; parsedResume: ParsedResume | null };
  const jobDoc = session.jobRoleId as unknown as { title: string; experienceLevel: string };
  const personaCtx: PersonaContext = {
    candidateName: candidateDoc.name ?? 'there',
    resumeSummary: candidateDoc.parsedResume?.summary ?? '',
    resumeSkills: candidateDoc.parsedResume?.skills ?? [],
    jobTitle: jobDoc.title ?? 'Software Engineer',
    experienceLevel: jobDoc.experienceLevel ?? 'mid',
  };
  const systemPrompt = buildSystemPrompt(personaCtx);

  // Add candidate answer to transcript
  const candidateEntry: TranscriptEntry = {
    id: uuidv4(),
    speaker: 'candidate',
    text: answerText,
    state: session.currentState as InterviewState,
    timestamp: new Date(),
    responseTimeMs: responseTimeMs ?? null,
  };
  session.transcript.push(candidateEntry);

  const currentState = session.currentState as InterviewState;
  let nextState = currentState;
  let aiMessage = '';
  let stateChanged = false;

  const ctx: StateMachineContext = {
    currentState,
    totalTopics: session.generatedQuestions.length,
    currentQuestionIndex: session.currentQuestionIndex,
    followUpCount: session.currentFollowUpIndex,
    maxFollowUpsPerQuestion: getSessionConfig(session).maxFollowUps,
  };

  if (currentState === 'INTRO') {
    const isReady = /ready|yes|sure|let'?s go|okay|ok|start|begin/i.test(answerText);
    if (isReady) {
      nextState = transition(ctx, 'CANDIDATE_READY');
      stateChanged = true;
      aiMessage = await getWarmupQuestion(personaCtx, session.transcript as TranscriptEntry[], getSessionConfig(session).warmupQuestions);
    } else {
      aiMessage = "No problem! Just let me know when you're ready to begin by saying \"ready\".";
    }
  } else if (currentState === 'WARMUP') {
    const warmupQuestionCount = session.transcript.filter(
      (e: TranscriptEntry) => e.speaker === 'ai' && e.state === 'WARMUP',
    ).length;

    if (warmupQuestionCount >= getSessionConfig(session).warmupQuestions) {
      nextState = transition(ctx, 'WARMUP_COMPLETE');
      stateChanged = true;
      const firstQuestion = session.generatedQuestions[0];
      if (firstQuestion) {
        aiMessage = await generateTransition(
          systemPrompt,
          session.transcript as TranscriptEntry[],
          'warmup',
          answerText,
          firstQuestion,
        );
      } else {
        aiMessage = "Thanks for that. Let's wrap up here.";
        nextState = 'WRAP_UP';
      }
    } else {
      aiMessage = await getWarmupFollowup(personaCtx, session.transcript as TranscriptEntry[], warmupQuestionCount, getSessionConfig(session).warmupQuestions);
    }
  } else if (isTopicState(currentState)) {
    const topicNum = getCurrentTopicNumber(currentState)!;
    const questionIndex = topicNum - 1;
    const currentQuestion = session.generatedQuestions[questionIndex];

    if (!currentQuestion) {
      nextState = transition(ctx, 'ALL_TOPICS_COMPLETE');
      stateChanged = true;
      aiMessage = await generateWrapUpTransition(systemPrompt, session.transcript as TranscriptEntry[]);
    } else {
      // LLM-powered answer evaluation (replaces word-count heuristic)
      const evaluation = await evaluateAnswer(
        currentQuestion.text,
        answerText,
        personaCtx.resumeSummary,
        currentQuestion.difficulty,
      );

      // Update performance snapshot
      updatePerformanceSnapshot(session, evaluation);

      const canFollowUp = session.currentFollowUpIndex < getSessionConfig(session).maxFollowUps;
      const shouldFollowUp = evaluation.needsFollowUp && canFollowUp;

      if (shouldFollowUp) {
        // Generate dynamic follow-up (falls back to pre-generated if LLM fails)
        aiMessage = await generateFollowUp(
          systemPrompt,
          session.transcript as TranscriptEntry[],
          currentQuestion,
          answerText,
          evaluation,
          personaCtx.resumeSummary,
        );
        session.currentFollowUpIndex++;
      } else {
        // Move to next topic or wrap up
        session.currentFollowUpIndex = 0;
        const nextQuestionIndex = questionIndex + 1;
        if (nextQuestionIndex < session.generatedQuestions.length) {
          nextState = transition(ctx, 'TOPIC_COMPLETE');
          stateChanged = true;
          let nextQuestion = session.generatedQuestions[nextQuestionIndex]!;
          session.currentQuestionIndex = nextQuestionIndex;

          // Dynamic difficulty: if performance bias shifted, regenerate question
          const snap = session.performanceSnapshot;
          if (snap && snap.difficultyBias !== 'same') {
            const adaptedQuestion = await generateAdaptiveQuestion(
              nextQuestion.topicArea,
              snap.difficultyBias === 'harder' ? escalateDifficulty(nextQuestion.difficulty) : reduceDifficulty(nextQuestion.difficulty),
              personaCtx,
              snap,
            );
            if (adaptedQuestion) {
              nextQuestion = { ...nextQuestion, ...adaptedQuestion };
              session.generatedQuestions[nextQuestionIndex] = nextQuestion;
            }
          }

          aiMessage = await generateTransition(
            systemPrompt,
            session.transcript as TranscriptEntry[],
            currentQuestion.topicArea,
            answerText,
            nextQuestion,
          );
        } else {
          nextState = transition(ctx, 'TOPIC_COMPLETE');
          stateChanged = true;
          aiMessage = await generateWrapUpTransition(systemPrompt, session.transcript as TranscriptEntry[]);
        }
      }
    }
  } else if (currentState === 'WRAP_UP') {
    nextState = transition(ctx, 'WRAP_UP_COMPLETE');
    stateChanged = true;
    aiMessage = await generateClosingMessage(systemPrompt, session.transcript as TranscriptEntry[], personaCtx.candidateName);
    session.status = 'COMPLETED';
    session.completedAt = new Date();
  }

  // Add AI response to transcript
  const aiEntry: TranscriptEntry = {
    id: uuidv4(),
    speaker: 'ai',
    text: aiMessage,
    state: nextState,
    timestamp: new Date(),
  };
  session.transcript.push(aiEntry);
  session.currentState = nextState;
  await session.save();

  const isComplete = nextState === 'SCORING' || nextState === 'WRAP_UP';
  if (nextState === 'SCORING') {
    await getScoringQueue().add('score-session', { sessionId });
  }

  return { nextState, aiMessage, transcriptEntry: candidateEntry, stateChanged, isComplete };
}

export async function recordAntiCheatEvent(sessionId: string, event: AntiCheatEvent): Promise<void> {
  await InterviewSessionModel.findByIdAndUpdate(
    sessionId,
    { $push: { antiCheatEvents: event } },
  );
}

export async function abandonSession(sessionId: string): Promise<void> {
  if (!mongoose.isValidObjectId(sessionId)) return;
  await InterviewSessionModel.findByIdAndUpdate(sessionId, {
    $set: { currentState: 'ABANDONED', status: 'ABANDONED', completedAt: new Date() },
  });
}

// --- Private helpers ---

type ParsedResume = {
  skills: string[];
  experience: Array<{ company: string; title: string; startDate: string; endDate: string | null; description: string }>;
  education: Array<{ institution: string; degree: string; field: string; graduationYear: number }>;
  summary: string;
};

async function generateQuestions(
  parsedResume: ParsedResume | null,
  job: { title: string; description: string; requiredSkills: string[]; topicAreas: string[]; experienceLevel: string },
): Promise<Question[]> {
  const llm = createLLMAdapter();

  const resumeContext = parsedResume
    ? `Skills: ${parsedResume.skills.join(', ')}\nSummary: ${parsedResume.summary}`
    : 'No resume provided';

  const prompt = `You are an expert technical interviewer. Generate interview questions for a ${job.experienceLevel} ${job.title} position.

Job Description: ${job.description.slice(0, 500)}
Required Skills: ${job.requiredSkills.join(', ')}
Topic Areas: ${job.topicAreas.join(', ')}
Candidate Background: ${resumeContext}

Generate exactly ${job.topicAreas.length} questions (one per topic area). Return ONLY valid JSON array:
[
  {
    "id": "q1",
    "topicArea": "topic name",
    "text": "The interview question",
    "followUpPrompts": ["follow up 1", "follow up 2"],
    "difficulty": "medium"
  }
]

Rules:
- Each question targets one topic area
- difficulty must be "easy", "medium", or "hard"
- Exactly 2 followUpPrompts per question
- Questions should be conversational, not trick questions`;

  const response = await llm.complete([
    { role: 'system', content: 'You are a technical interviewer. Return only valid JSON.' },
    { role: 'user', content: prompt },
  ], { maxTokens: 3000, temperature: 0.7 });

  try {
    const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
    const questions = JSON.parse(cleaned) as Question[];
    return questions.map((q, i) => ({ ...q, id: `q${i + 1}` }));
  } catch {
    logger.error('Failed to parse LLM question generation response');
    return job.topicAreas.map((area, i) => ({
      id: `q${i + 1}`,
      topicArea: area,
      text: `Can you walk me through your experience with ${area}?`,
      followUpPrompts: [
        `Can you give me a specific example?`,
        `What challenges did you face and how did you overcome them?`,
      ],
      difficulty: 'medium' as const,
    }));
  }
}

async function evaluateAnswer(
  questionText: string,
  answerText: string,
  resumeSummary: string,
  difficulty: string,
): Promise<AnswerEvaluation> {
  const llm = createLLMAdapter();
  const prompt = buildEvaluationPrompt(questionText, answerText, resumeSummary, difficulty);

  try {
    const response = await llm.complete([
      { role: 'system', content: 'You are an expert interview evaluator. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ], { maxTokens: 300, temperature: 0 });

    const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned) as AnswerEvaluation;

    return {
      needsFollowUp: parsed.needsFollowUp ?? false,
      reason: parsed.reason ?? 'adequate',
      detectedStrength: parsed.detectedStrength ?? null,
      detectedWeakness: parsed.detectedWeakness ?? null,
      suggestedProbe: parsed.suggestedProbe ?? null,
      confidenceLevel: typeof parsed.confidenceLevel === 'number' ? parsed.confidenceLevel : 0.7,
    };
  } catch {
    // Fallback to word-count heuristic if LLM fails
    const wordCount = answerText.trim().split(/\s+/).length;
    return {
      needsFollowUp: wordCount < 50,
      reason: wordCount < 50 ? 'shallow' : 'adequate',
      detectedStrength: null,
      detectedWeakness: null,
      suggestedProbe: null,
      confidenceLevel: 0.3,
    };
  }
}

function updatePerformanceSnapshot(
  session: { performanceSnapshot: PerformanceSnapshot | null },
  evaluation: AnswerEvaluation,
): void {
  if (!session.performanceSnapshot) {
    session.performanceSnapshot = {
      averageEvalConfidence: evaluation.confidenceLevel,
      excellentCount: 0,
      adequateCount: 0,
      weakCount: 0,
      difficultyBias: 'same',
    };
  }

  const snap = session.performanceSnapshot;

  if (evaluation.reason === 'excellent') {
    snap.excellentCount++;
  } else if (evaluation.reason === 'adequate') {
    snap.adequateCount++;
  } else {
    snap.weakCount++;
  }

  const totalAnswers = snap.excellentCount + snap.adequateCount + snap.weakCount;
  snap.averageEvalConfidence =
    (snap.averageEvalConfidence * (totalAnswers - 1) + evaluation.confidenceLevel) / totalAnswers;

  // Determine difficulty bias based on performance trend
  const strongRatio = snap.excellentCount / totalAnswers;
  const weakRatio = snap.weakCount / totalAnswers;
  if (strongRatio > 0.6 && totalAnswers >= 2) {
    snap.difficultyBias = 'harder';
  } else if (weakRatio > 0.6 && totalAnswers >= 2) {
    snap.difficultyBias = 'easier';
  } else {
    snap.difficultyBias = 'same';
  }
}

async function generateTransition(
  systemPrompt: string,
  transcript: TranscriptEntry[],
  previousTopicArea: string,
  previousAnswer: string,
  nextQuestion: Question,
): Promise<string> {
  const llm = createLLMAdapter();
  const conversationHistory = buildConversationHistory(transcript, systemPrompt);
  const transitionInstruction = buildTransitionPrompt(previousTopicArea, previousAnswer, nextQuestion);

  conversationHistory.push({ role: 'user', content: transitionInstruction });

  try {
    return await llm.complete(conversationHistory, { maxTokens: 200, temperature: 0.6 });
  } catch {
    // Fallback: basic transition with question
    return `That's interesting, thank you. Let me ask you about something different. ${nextQuestion.text}`;
  }
}

async function generateWrapUpTransition(
  systemPrompt: string,
  transcript: TranscriptEntry[],
): Promise<string> {
  const llm = createLLMAdapter();
  const conversationHistory = buildConversationHistory(transcript, systemPrompt);

  conversationHistory.push({
    role: 'user',
    content: 'All technical topics are covered. Generate a brief, warm transition to wrap up the interview. Thank the candidate for their answers and let them know you have one final question — ask if there is anything they would like to add or any questions they have about the role. Keep it to 2-3 sentences. Return only the spoken text.',
  });

  try {
    return await llm.complete(conversationHistory, { maxTokens: 150, temperature: 0.6 });
  } catch {
    return "We've covered all the technical topics I had planned. Before we wrap up, is there anything you'd like to add or any questions about the role?";
  }
}

async function generateClosingMessage(
  systemPrompt: string,
  transcript: TranscriptEntry[],
  candidateName: string,
): Promise<string> {
  const llm = createLLMAdapter();
  const conversationHistory = buildConversationHistory(transcript, systemPrompt);

  conversationHistory.push({
    role: 'user',
    content: `Close the interview warmly. Thank ${candidateName} for their time, mention that responses will be reviewed and they'll hear back soon. Keep it to 2-3 sentences, genuine and professional. Return only the spoken text.`,
  });

  try {
    return await llm.complete(conversationHistory, { maxTokens: 150, temperature: 0.6 });
  } catch {
    return `Thank you so much for your time today, ${candidateName}! It was great talking with you. We'll review your responses and be in touch soon. Have a wonderful day!`;
  }
}

async function generateFollowUp(
  systemPrompt: string,
  transcript: TranscriptEntry[],
  question: Question,
  answerText: string,
  evaluation: AnswerEvaluation,
  resumeSummary: string,
): Promise<string> {
  const llm = createLLMAdapter();
  const conversationHistory = buildConversationHistory(transcript, systemPrompt);
  const followUpInstruction = buildFollowUpPrompt(
    question.text,
    answerText,
    { reason: evaluation.reason, suggestedProbe: evaluation.suggestedProbe },
    resumeSummary,
  );

  conversationHistory.push({ role: 'user', content: followUpInstruction });

  try {
    return await llm.complete(conversationHistory, { maxTokens: 150, temperature: 0.6 });
  } catch {
    // Fallback to pre-generated follow-up
    const fallbackIndex = question.followUpPrompts.length > 0 ? 0 : -1;
    return fallbackIndex >= 0
      ? question.followUpPrompts[fallbackIndex]!
      : 'Could you elaborate on that a bit more?';
  }
}

async function getWarmupQuestion(personaCtx: PersonaContext, transcript: TranscriptEntry[], totalWarmup: number = DEFAULT_WARMUP_QUESTIONS): Promise<string> {
  const llm = createLLMAdapter();
  const systemPrompt = buildSystemPrompt(personaCtx);
  const conversationHistory = buildConversationHistory(transcript, systemPrompt);
  const warmupInstruction = buildWarmupPrompt(personaCtx.candidateName, transcript, 1, totalWarmup);

  conversationHistory.push({ role: 'user', content: warmupInstruction });

  try {
    return await llm.complete(conversationHistory, { maxTokens: 150, temperature: 0.8 });
  } catch {
    return `Great, ${personaCtx.candidateName}! To start us off, tell me a bit about what you're working on these days.`;
  }
}

async function getWarmupFollowup(
  personaCtx: PersonaContext,
  transcript: TranscriptEntry[],
  questionCount: number,
  totalWarmup: number = DEFAULT_WARMUP_QUESTIONS,
): Promise<string> {
  const llm = createLLMAdapter();
  const systemPrompt = buildSystemPrompt(personaCtx);
  const conversationHistory = buildConversationHistory(transcript, systemPrompt);
  const warmupInstruction = buildWarmupPrompt(
    personaCtx.candidateName,
    transcript,
    questionCount + 1,
    totalWarmup,
  );

  conversationHistory.push({ role: 'user', content: warmupInstruction });

  try {
    return await llm.complete(conversationHistory, { maxTokens: 150, temperature: 0.8 });
  } catch {
    return "That's really interesting. What's been the most challenging part of that work?";
  }
}

function escalateDifficulty(current: string): string {
  if (current === 'easy') return 'medium';
  return 'hard';
}

function reduceDifficulty(current: string): string {
  if (current === 'hard') return 'medium';
  return 'easy';
}

async function generateAdaptiveQuestion(
  topicArea: string,
  difficulty: string,
  personaCtx: PersonaContext,
  snapshot: PerformanceSnapshot,
): Promise<{ text: string; followUpPrompts: string[]; difficulty: 'easy' | 'medium' | 'hard' } | null> {
  const llm = createLLMAdapter();

  const prompt = `Generate a single ${difficulty} difficulty interview question for a ${personaCtx.experienceLevel} ${personaCtx.jobTitle} candidate on the topic of "${topicArea}".

Candidate performance so far: ${snapshot.excellentCount} excellent, ${snapshot.adequateCount} adequate, ${snapshot.weakCount} weak answers.
Difficulty adjustment: questions should be ${difficulty} (adjusted based on performance).
Candidate skills from resume: ${personaCtx.resumeSkills.slice(0, 8).join(', ')}

Return ONLY valid JSON:
{
  "text": "The interview question",
  "followUpPrompts": ["follow up 1", "follow up 2"],
  "difficulty": "${difficulty}"
}

The question should be conversational and appropriate for the ${difficulty} level.`;

  try {
    const response = await llm.complete([
      { role: 'system', content: 'You are a technical interviewer. Return only valid JSON.' },
      { role: 'user', content: prompt },
    ], { maxTokens: 300, temperature: 0.7 });

    const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned) as { text: string; followUpPrompts: string[]; difficulty: string };
    const validDifficulties = ['easy', 'medium', 'hard'] as const;
    const parsedDifficulty = validDifficulties.includes(parsed.difficulty as 'easy' | 'medium' | 'hard')
      ? (parsed.difficulty as 'easy' | 'medium' | 'hard')
      : 'medium';
    return { ...parsed, difficulty: parsedDifficulty };
  } catch {
    return null; // Use the pre-generated question as-is
  }
}
