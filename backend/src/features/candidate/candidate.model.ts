import mongoose, { type Document, type Model } from 'mongoose';

export interface ICandidate extends Document {
  email: string;
  name: string;
  passwordHash: string;
  role: 'candidate' | 'recruiter';
  resumeUrl: string | null;
  parsedResume: {
    skills: string[];
    experience: Array<{
      company: string;
      title: string;
      startDate: string;
      endDate: string | null;
      description: string;
    }>;
    education: Array<{
      institution: string;
      degree: string;
      field: string;
      graduationYear: number;
    }>;
    summary: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

const experienceSchema = new mongoose.Schema({
  company: { type: String, required: true },
  title: { type: String, required: true },
  startDate: { type: String, required: true },
  endDate: { type: String, default: null },
  description: { type: String, default: '' },
}, { _id: false });

const educationSchema = new mongoose.Schema({
  institution: { type: String, required: true },
  degree: { type: String, required: true },
  field: { type: String, required: true },
  graduationYear: { type: Number, required: true },
}, { _id: false });

const parsedResumeSchema = new mongoose.Schema({
  skills: [{ type: String }],
  experience: [experienceSchema],
  education: [educationSchema],
  summary: { type: String, default: '' },
}, { _id: false });

const candidateSchema = new mongoose.Schema<ICandidate>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['candidate', 'recruiter'], required: true },
    resumeUrl: { type: String, default: null },
    parsedResume: { type: parsedResumeSchema, default: null },
  },
  { timestamps: true },
);

export const CandidateModel: Model<ICandidate> = mongoose.model<ICandidate>(
  'Candidate',
  candidateSchema,
);
