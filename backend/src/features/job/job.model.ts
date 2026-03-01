import mongoose, { type Document, type Model } from 'mongoose';
import type { ExperienceLevel } from '../../shared/types';

export interface IJobRole extends Document {
  recruiterId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  requiredSkills: string[];
  experienceLevel: ExperienceLevel;
  domain: string;
  topicAreas: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

jobRoleSchema.index({ recruiterId: 1 });
jobRoleSchema.index({ isActive: 1 });

export const JobRoleModel: Model<IJobRole> = mongoose.model<IJobRole>('JobRole', jobRoleSchema);
