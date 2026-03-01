import type { Request } from 'express';
import type { Types } from 'mongoose';

export interface AuthPayload {
  userId: string;
  email: string;
  role: 'candidate' | 'recruiter';
}

export interface AuthenticatedRequest extends Request {
  user: AuthPayload;
}

export type UserRole = 'candidate' | 'recruiter';
export type ExperienceLevel = 'junior' | 'mid' | 'senior' | 'staff';

export type InterviewState =
  | 'INTRO'
  | 'WARMUP'
  | `TOPIC_${number}`
  | 'WRAP_UP'
  | 'SCORING'
  | 'DONE'
  | 'ABANDONED';

export type InterviewStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';

export interface Question {
  id: string;
  topicArea: string;
  text: string;
  followUpPrompts: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface TranscriptEntry {
  id: string;
  speaker: 'ai' | 'candidate';
  text: string;
  state: InterviewState;
  timestamp: Date;
}

export interface AntiCheatEvent {
  type: 'TAB_SWITCH' | 'WINDOW_BLUR' | 'GAZE_LOST' | 'COPY_PASTE' | 'MULTIPLE_FACES';
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export interface ScoreDimensions {
  technical: number;
  communication: number;
  depth: number;
  relevance: number;
}

export type HiringRecommendation = 'STRONG_HIRE' | 'HIRE' | 'BORDERLINE' | 'NO_HIRE';

export type ObjectId = Types.ObjectId;
