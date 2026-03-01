import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { InterviewSessionModel } from './interview.model';
import { JobRoleModel } from '../job/job.model';
import { CandidateModel } from '../candidate/candidate.model';
import { AppError } from '../../shared/errors/app-error';
import { createLLMAdapter } from '../../adapters/llm';
import { getScoringQueue } from '../../lib/queue';
import type { Question, TranscriptEntry, AntiCheatEvent, InterviewState } from '../../shared/types';
import {
  transition,
  isTerminalState,
  getCurrentTopicNumber,
  isTopicState,
  type StateMachineContext,
} from './interview.state-machine';

const MAX_FOLLOW_UPS = 2;
const WARMUP_QUESTIONS_COUNT = 2;

export async function createSession(candidateId: string, jobRoleId: string) {
  if (!mongoose.isValidObjectId(jobRoleId)) throw AppError.badRequest('Invalid jobRoleId');

  const [candidate, job] = await Promise.all([
    CandidateModel.findById(candidateId).lean(),
    JobRoleModel.findById(jobRoleId).lean(),
  ]);

  if (!candidate) throw AppError.notFound('Candidate not found');
  if (!job || !job.isActive) throw AppError.notFound('Job not found or inactive');

  const questions = await generateQuestions(
    candidate.parsedResume,
    { title: job.title, description: job.description, requiredSkills: job.requiredSkills, topicAreas: job.topicAreas, experienceLevel: job.experienceLevel },
  );

  const session = await InterviewSessionModel.create({
    candidateId,
    jobRoleId,
    currentState: 'INTRO',
    status: 'SCHEDULED',
    generatedQuestions: questions,
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

export async function getIntroMessage(): Promise<string> {
  return "Hello! I'm your AI interviewer today. We'll have a conversation about your background and technical experience. The interview will take about 30-45 minutes. Feel free to take your time with answers. When you're ready to begin, just say 'ready' or type 'ready'.";
}

export async function processAnswer(
  sessionId: string,
  candidateId: string,
  answerText: string,
): Promise<{
  nextState: InterviewState;
  aiMessage: string;
  transcriptEntry: TranscriptEntry;
  stateChanged: boolean;
  isComplete: boolean;
}> {
  const session = await InterviewSessionModel.findOne({ _id: sessionId, candidateId });
  if (!session) throw AppError.notFound('Session not found');
  if (isTerminalState(session.currentState as InterviewState)) {
    throw AppError.badRequest('Interview is already complete');
  }

  // Add candidate answer to transcript
  const candidateEntry: TranscriptEntry = {
    id: uuidv4(),
    speaker: 'candidate',
    text: answerText,
    state: session.currentState as InterviewState,
    timestamp: new Date(),
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
    maxFollowUpsPerQuestion: MAX_FOLLOW_UPS,
  };

  if (currentState === 'INTRO') {
    const isReady = /ready|yes|sure|let'?s go|okay|ok|start|begin/i.test(answerText);
    if (isReady) {
      nextState = transition(ctx, 'CANDIDATE_READY');
      stateChanged = true;
      aiMessage = await getWarmupQuestion(session.transcript);
    } else {
      aiMessage = "No problem! Just let me know when you're ready to begin by saying 'ready'.";
    }
  } else if (currentState === 'WARMUP') {
    const warmupQuestionCount = session.transcript.filter(
      e => e.speaker === 'ai' && e.state === 'WARMUP',
    ).length;

    if (warmupQuestionCount >= WARMUP_QUESTIONS_COUNT) {
      nextState = transition(ctx, 'WARMUP_COMPLETE');
      stateChanged = true;
      const firstQuestion = session.generatedQuestions[0];
      if (firstQuestion) {
        aiMessage = `Great, let's move into the technical portion. ${firstQuestion.text}`;
      } else {
        aiMessage = "Thanks for that. Let's wrap up here.";
        nextState = 'WRAP_UP';
      }
    } else {
      aiMessage = await getWarmupFollowup(session.transcript, warmupQuestionCount);
    }
  } else if (isTopicState(currentState)) {
    const topicNum = getCurrentTopicNumber(currentState)!;
    const questionIndex = topicNum - 1;
    const currentQuestion = session.generatedQuestions[questionIndex];

    if (!currentQuestion) {
      nextState = transition(ctx, 'ALL_TOPICS_COMPLETE');
      stateChanged = true;
      aiMessage = "Thank you for all your answers. Let's wrap up.";
    } else {
      const hasFollowUps = session.currentFollowUpIndex < MAX_FOLLOW_UPS &&
        currentQuestion.followUpPrompts[session.currentFollowUpIndex];
      const shouldFollowUp = await evaluateAnswerDepth(answerText);

      if (hasFollowUps && shouldFollowUp) {
        aiMessage = currentQuestion.followUpPrompts[session.currentFollowUpIndex]!;
        session.currentFollowUpIndex++;
      } else {
        // Move to next topic or wrap up
        session.currentFollowUpIndex = 0;
        const nextQuestionIndex = questionIndex + 1;
        if (nextQuestionIndex < session.generatedQuestions.length) {
          nextState = transition(ctx, 'TOPIC_COMPLETE');
          stateChanged = true;
          const nextQuestion = session.generatedQuestions[nextQuestionIndex]!;
          session.currentQuestionIndex = nextQuestionIndex;
          aiMessage = `Good answer. Moving on: ${nextQuestion.text}`;
        } else {
          nextState = transition(ctx, 'TOPIC_COMPLETE');
          stateChanged = true;
          aiMessage = "Excellent! We've covered all the technical topics. Let's wrap up.";
        }
      }
    }
  } else if (currentState === 'WRAP_UP') {
    nextState = transition(ctx, 'WRAP_UP_COMPLETE');
    stateChanged = true;
    aiMessage = "Thank you so much for your time today! We'll review your responses and be in touch soon. Have a great day!";
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

async function generateQuestions(
  parsedResume: ICandidate['parsedResume'],
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
    console.error('[QuestionGen] Failed to parse LLM response');
    // Fallback question
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

type ICandidate = {
  parsedResume: {
    skills: string[];
    experience: Array<{ company: string; title: string; startDate: string; endDate: string | null; description: string }>;
    education: Array<{ institution: string; degree: string; field: string; graduationYear: number }>;
    summary: string;
  } | null;
};

async function getWarmupQuestion(transcript: TranscriptEntry[]): Promise<string> {
  const llm = createLLMAdapter();
  const response = await llm.complete([
    { role: 'system', content: 'You are a friendly interviewer starting a warmup conversation.' },
    { role: 'user', content: 'Ask a single warm-up question to get the candidate comfortable. Keep it brief and conversational. Ask about their background or what they\'re currently working on.' },
  ], { maxTokens: 150, temperature: 0.8 });
  return response;
}

async function getWarmupFollowup(transcript: TranscriptEntry[], questionCount: number): Promise<string> {
  const llm = createLLMAdapter();
  const lastAnswer = transcript.filter(e => e.speaker === 'candidate').pop()?.text ?? '';
  const response = await llm.complete([
    { role: 'system', content: 'You are a friendly interviewer in a warmup conversation.' },
    { role: 'user', content: `The candidate said: "${lastAnswer.slice(0, 200)}". Ask warmup question ${questionCount + 1} of ${WARMUP_QUESTIONS_COUNT}. Keep it brief.` },
  ], { maxTokens: 150, temperature: 0.8 });
  return response;
}

async function evaluateAnswerDepth(answerText: string): Promise<boolean> {
  // Simple heuristic: short answers (< 50 words) get a follow-up
  const wordCount = answerText.trim().split(/\s+/).length;
  return wordCount < 50;
}
