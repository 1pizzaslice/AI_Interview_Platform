import mongoose, { type Document, type Model } from 'mongoose';
import type { ScoreDimensions } from '../../shared/types';

export interface IScore extends Document {
  sessionId: mongoose.Types.ObjectId;
  questionId: string;
  questionText: string;
  answerText: string;
  overallScore: number;
  dimensions: ScoreDimensions;
  reasoning: string;
  createdAt: Date;
}

const scoreDimensionsSchema = new mongoose.Schema<ScoreDimensions>(
  {
    technical: { type: Number, required: true, min: 0, max: 10 },
    communication: { type: Number, required: true, min: 0, max: 10 },
    depth: { type: Number, required: true, min: 0, max: 10 },
    relevance: { type: Number, required: true, min: 0, max: 10 },
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
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

scoreSchema.index({ sessionId: 1 });

export const ScoreModel: Model<IScore> = mongoose.model<IScore>('Score', scoreSchema);
