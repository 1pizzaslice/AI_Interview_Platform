import mongoose, { type Document, type Model } from 'mongoose';
import type { HiringRecommendation } from '../../shared/types';

export interface IReport extends Document {
  sessionId: mongoose.Types.ObjectId;
  candidateId: mongoose.Types.ObjectId;
  jobRoleId: mongoose.Types.ObjectId;
  overallScore: number;
  dimensionScores: {
    technical: number;
    communication: number;
    problemSolving: number;
    culturalFit: number;
  };
  strengths: string[];
  weaknesses: string[];
  recommendation: HiringRecommendation;
  summary: string;
  antiCheatFlags: string[];
  questionScores: Array<{
    questionId: string;
    questionText: string;
    score: number;
    summary: string;
  }>;
  generatedAt: Date;
}

const dimensionScoresSchema = new mongoose.Schema(
  {
    technical: { type: Number, required: true },
    communication: { type: Number, required: true },
    problemSolving: { type: Number, required: true },
    culturalFit: { type: Number, required: true },
  },
  { _id: false },
);

const questionScoreSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    questionText: { type: String, required: true },
    score: { type: Number, required: true },
    summary: { type: String, required: true },
  },
  { _id: false },
);

const reportSchema = new mongoose.Schema<IReport>(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSession', required: true, unique: true },
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
    jobRoleId: { type: mongoose.Schema.Types.ObjectId, ref: 'JobRole', required: true },
    overallScore: { type: Number, required: true, min: 0, max: 100 },
    dimensionScores: { type: dimensionScoresSchema, required: true },
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    recommendation: {
      type: String,
      enum: ['STRONG_HIRE', 'HIRE', 'BORDERLINE', 'NO_HIRE'],
      required: true,
    },
    summary: { type: String, required: true },
    antiCheatFlags: [{ type: String }],
    questionScores: [questionScoreSchema],
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

reportSchema.index({ candidateId: 1 });
reportSchema.index({ jobRoleId: 1 });

export const ReportModel: Model<IReport> = mongoose.model<IReport>('Report', reportSchema);
