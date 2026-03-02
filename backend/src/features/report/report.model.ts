import mongoose, { type Document, type Model } from 'mongoose';
import type { HiringRecommendation, RedFlag, ConsistencyResult } from '../../shared/types';

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
    resumeAlignment: number;
  };
  strengths: string[];
  weaknesses: string[];
  recommendation: HiringRecommendation;
  summary: string;
  antiCheatFlags: string[];
  redFlags: RedFlag[];
  consistency: ConsistencyResult | null;
  averageConfidence: number;
  questionScores: Array<{
    questionId: string;
    questionText: string;
    score: number;
    summary: string;
    confidence: number;
  }>;
  generatedAt: Date;
}

const dimensionScoresSchema = new mongoose.Schema(
  {
    technical: { type: Number, required: true },
    communication: { type: Number, required: true },
    problemSolving: { type: Number, required: true },
    culturalFit: { type: Number, required: true },
    resumeAlignment: { type: Number, default: 50 },
  },
  { _id: false },
);

const questionScoreSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    questionText: { type: String, required: true },
    score: { type: Number, required: true },
    summary: { type: String, required: true },
    confidence: { type: Number, default: 0.7 },
  },
  { _id: false },
);

const redFlagSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['ai_generated', 'memorized_answer', 'timing_anomaly', 'resume_contradiction'], required: true },
    severity: { type: String, enum: ['low', 'medium', 'high'], required: true },
    description: { type: String, required: true },
    evidence: { type: String, required: true },
  },
  { _id: false },
);

const consistencySchema = new mongoose.Schema(
  {
    consistencyScore: { type: Number, required: true },
    contradictions: [{ type: String }],
    flags: [{ type: String }],
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
    redFlags: [redFlagSchema],
    consistency: { type: consistencySchema, default: null },
    averageConfidence: { type: Number, default: 0.7 },
    questionScores: [questionScoreSchema],
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

reportSchema.index({ candidateId: 1 });
reportSchema.index({ jobRoleId: 1 });

export const ReportModel: Model<IReport> = mongoose.model<IReport>('Report', reportSchema);
