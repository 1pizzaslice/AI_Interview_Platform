import mongoose, { type Document, type Model } from 'mongoose';
import type { InterviewState, InterviewStatus, Question, TranscriptEntry, AntiCheatEvent, PerformanceSnapshot } from '../../shared/types';

export interface IInterviewConfig {
  maxTopics: number;
  warmupQuestions: number;
  maxFollowUps: number;
  estimatedDurationMinutes: number;
}

export interface IInterviewSession extends Document {
  candidateId: mongoose.Types.ObjectId;
  jobRoleId: mongoose.Types.ObjectId;
  status: InterviewStatus;
  currentState: InterviewState;
  generatedQuestions: Question[];
  transcript: TranscriptEntry[];
  antiCheatEvents: AntiCheatEvent[];
  currentQuestionIndex: number;
  currentFollowUpIndex: number;
  performanceSnapshot: PerformanceSnapshot | null;
  interviewConfig: IInterviewConfig | null;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const questionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  topicArea: { type: String, required: true },
  text: { type: String, required: true },
  followUpPrompts: [{ type: String }],
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
}, { _id: false });

const transcriptEntrySchema = new mongoose.Schema({
  id: { type: String, required: true },
  speaker: { type: String, enum: ['ai', 'candidate'], required: true },
  text: { type: String, required: true },
  state: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  responseTimeMs: { type: Number, default: null },
}, { _id: false });

const antiCheatEventSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['TAB_SWITCH', 'WINDOW_BLUR', 'GAZE_LOST', 'COPY_PASTE', 'MULTIPLE_FACES'],
    required: true,
  },
  timestamp: { type: Date, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false });

const interviewSessionSchema = new mongoose.Schema<IInterviewSession>(
  {
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
    jobRoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobRole', required: true },
    status: {
      type: String,
      enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED'],
      default: 'SCHEDULED',
    },
    currentState: { type: String, default: 'INTRO' },
    generatedQuestions: [questionSchema],
    transcript: [transcriptEntrySchema],
    antiCheatEvents: [antiCheatEventSchema],
    currentQuestionIndex: { type: Number, default: 0 },
    currentFollowUpIndex: { type: Number, default: 0 },
    performanceSnapshot: {
      type: new mongoose.Schema({
        averageEvalConfidence: { type: Number, default: 0 },
        excellentCount: { type: Number, default: 0 },
        adequateCount: { type: Number, default: 0 },
        weakCount: { type: Number, default: 0 },
        difficultyBias: { type: String, enum: ['easier', 'same', 'harder'], default: 'same' },
      }, { _id: false }),
      default: null,
    },
    interviewConfig: {
      type: new mongoose.Schema({
        maxTopics: { type: Number, default: 5 },
        warmupQuestions: { type: Number, default: 2 },
        maxFollowUps: { type: Number, default: 2 },
        estimatedDurationMinutes: { type: Number, default: 30 },
      }, { _id: false }),
      default: null,
    },
    scheduledAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

interviewSessionSchema.index({ candidateId: 1 });
interviewSessionSchema.index({ jobRoleId: 1 });
interviewSessionSchema.index({ status: 1 });

export const InterviewSessionModel: Model<IInterviewSession> = mongoose.model<IInterviewSession>(
  'InterviewSession',
  interviewSessionSchema,
);
