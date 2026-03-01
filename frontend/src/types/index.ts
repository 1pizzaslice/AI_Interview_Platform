export type UserRole = 'candidate' | 'recruiter';
export type ExperienceLevel = 'junior' | 'mid' | 'senior' | 'staff';
export type HiringRecommendation = 'STRONG_HIRE' | 'HIRE' | 'BORDERLINE' | 'NO_HIRE';

export type InterviewState =
  | 'INTRO'
  | 'WARMUP'
  | `TOPIC_${number}`
  | 'WRAP_UP'
  | 'SCORING'
  | 'DONE'
  | 'ABANDONED';

export interface WSClientEvent {
  type: 'join' | 'answer' | 'anticheat' | 'ping';
  sessionId?: string;
  token?: string;
  text?: string;
  event?: AntiCheatEvent;
}

export interface WSServerEvent {
  type: 'joined' | 'state_change' | 'ai_message' | 'transcript_update' | 'score_update' | 'interview_complete' | 'session_abandoned' | 'error' | 'pong' | 'candidate_transcript' | 'stt_empty';
  sessionId?: string;
  currentState?: InterviewState;
  state?: InterviewState;
  text?: string;
  audioUrl?: string;
  reportId?: string;
  code?: string;
  message?: string;
}

export interface AntiCheatEvent {
  type: 'TAB_SWITCH' | 'WINDOW_BLUR' | 'GAZE_LOST' | 'COPY_PASTE' | 'MULTIPLE_FACES';
  timestamp: Date;
  metadata: Record<string, unknown>;
}
