import mongoose, { type Document, type Model } from 'mongoose';
import type { ExperienceLevel } from '../../shared/types';

export interface IInterviewConfig {
  maxTopics: number;
  warmupQuestions: number;
  maxFollowUps: number;
  difficultyDistribution: { easy: number; medium: number; hard: number };
  estimatedDurationMinutes: number;
}

export interface IJobRole extends Document {
  recruiterId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  requiredSkills: string[];
  experienceLevel: ExperienceLevel;
  domain: string;
  topicAreas: string[];
  interviewConfig: IInterviewConfig | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const interviewConfigSchema = new mongoose.Schema(
  {
    maxTopics: { type: Number, default: 5, min: 1, max: 15 },
    warmupQuestions: { type: Number, default: 2, min: 0, max: 5 },
    maxFollowUps: { type: Number, default: 2, min: 0, max: 5 },
    difficultyDistribution: {
      easy: { type: Number, default: 20 },
      medium: { type: Number, default: 60 },
      hard: { type: Number, default: 20 },
    },
    estimatedDurationMinutes: { type: Number, default: 30, min: 10, max: 90 },
  },
  { _id: false },
);

const jobRoleSchema = new mongoose.Schema<IJobRole>(
  {
    recruiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    requiredSkills: [{ type: String }],
    experienceLevel: {
      type: String,
      enum: ['junior', 'mid', 'senior', 'staff'],
      required: true,
    },
    domain: { type: String, required: true },
    topicAreas: [{ type: String }],
    interviewConfig: { type: interviewConfigSchema, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

jobRoleSchema.index({ recruiterId: 1 });
jobRoleSchema.index({ isActive: 1 });

export const JobRoleModel: Model<IJobRole> = mongoose.model<IJobRole>('JobRole', jobRoleSchema);
