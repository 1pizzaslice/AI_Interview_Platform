import mongoose, { type Document, type Model } from 'mongoose';
import type { ScoreDimensions, RedFlag, ConsistencyResult } from '../../shared/types';

export interface IScore extends Document {
  sessionId: mongoose.Types.ObjectId;
  questionId: string;
  questionText: string;
  answerText: string;
  overallScore: number;
  dimensions: ScoreDimensions;
  reasoning: string;
  confidence: number;
  createdAt: Date;
}

export interface ISessionScoreMeta extends Document {
  sessionId: mongoose.Types.ObjectId;
  consistency: ConsistencyResult;
  redFlags: RedFlag[];
  createdAt: Date;
}

const scoreDimensionsSchema = new mongoose.Schema<ScoreDimensions>(
  {
    technical: { type: Number, required: true, min: 0, max: 10 },
    communication: { type: Number, required: true, min: 0, max: 10 },
    depth: { type: Number, required: true, min: 0, max: 10 },
    relevance: { type: Number, required: true, min: 0, max: 10 },
    resumeAlignment: { type: Number, default: null, min: 0, max: 10 },
    confidence: { type: Number, default: null, min: 0, max: 1 },
  },
  { _id: false },
);

const scoreSchema = new mongoose.Schema<IScore>(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSession', required: true },
    questionId: { type: String, required: true },
    questionText: { type: String, required: true },
    answerText: { type: String, required: true },
    overallScore: { type: Number, required: true, min: 0, max: 10 },
    dimensions: { type: scoreDimensionsSchema, required: true },
    reasoning: { type: String, required: true },
    confidence: { type: Number, default: 0.7, min: 0, max: 1 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

scoreSchema.index({ sessionId: 1 });

const redFlagSchema = new mongoose.Schema({
  type: { type: String, enum: ['ai_generated', 'memorized_answer', 'timing_anomaly', 'resume_contradiction'], required: true },
  severity: { type: String, enum: ['low', 'medium', 'high'], required: true },
  description: { type: String, required: true },
  evidence: { type: String, required: true },
}, { _id: false });

const consistencySchema = new mongoose.Schema({
  consistencyScore: { type: Number, required: true, min: 0, max: 10 },
  contradictions: [{ type: String }],
  flags: [{ type: String }],
}, { _id: false });

const sessionScoreMetaSchema = new mongoose.Schema<ISessionScoreMeta>(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSession', required: true, unique: true },
    consistency: { type: consistencySchema, required: true },
    redFlags: [redFlagSchema],
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

sessionScoreMetaSchema.index({ sessionId: 1 });

export const ScoreModel: Model<IScore> = mongoose.model<IScore>('Score', scoreSchema);
export const SessionScoreMetaModel: Model<ISessionScoreMeta> = mongoose.model<ISessionScoreMeta>('SessionScoreMeta', sessionScoreMetaSchema);
