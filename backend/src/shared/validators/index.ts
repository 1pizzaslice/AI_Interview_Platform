import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(128),
  role: z.enum(['candidate', 'recruiter']),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const createJobSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().min(10),
  requiredSkills: z.array(z.string()).min(1),
  experienceLevel: z.enum(['junior', 'mid', 'senior', 'staff']),
  domain: z.string().min(1),
  topicAreas: z.array(z.string()).min(1),
});

export const updateJobSchema = createJobSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const createInterviewSchema = z.object({
  jobRoleId: z.string().length(24),
});

export const antiCheatEventSchema = z.object({
  sessionId: z.string().min(1),
  event: z.object({
    type: z.enum(['TAB_SWITCH', 'WINDOW_BLUR', 'GAZE_LOST', 'COPY_PASTE', 'MULTIPLE_FACES']),
    timestamp: z.coerce.date(),
    metadata: z.record(z.unknown()).default({}),
  }),
});

export const answerSchema = z.object({
  sessionId: z.string().min(1),
  text: z.string().min(1),
});

export const createQuestionBankSchema = z.object({
  name: z.string().min(1).max(200),
  jobRoleId: z.string().length(24).optional(),
  questions: z.array(z.object({
    text: z.string().min(1),
    topicArea: z.string().min(1),
    difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
    followUpPrompts: z.array(z.string()).default([]),
  })).default([]),
});

export const updateQuestionBankSchema = createQuestionBankSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const addToPipelineSchema = z.object({
  candidateId: z.string().length(24),
  jobRoleId: z.string().length(24),
  sessionId: z.string().length(24).optional(),
  stage: z.enum(['applied', 'screened', 'interviewed', 'offered', 'rejected']).default('applied'),
  notes: z.string().default(''),
});

export const updatePipelineStageSchema = z.object({
  stage: z.enum(['applied', 'screened', 'interviewed', 'offered', 'rejected']),
  notes: z.string().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type CreateInterviewInput = z.infer<typeof createInterviewSchema>;
export type AntiCheatEventInput = z.infer<typeof antiCheatEventSchema>;
export type AnswerInput = z.infer<typeof answerSchema>;
export type CreateQuestionBankInput = z.infer<typeof createQuestionBankSchema>;
export type UpdateQuestionBankInput = z.infer<typeof updateQuestionBankSchema>;
export type AddToPipelineInput = z.infer<typeof addToPipelineSchema>;
export type UpdatePipelineStageInput = z.infer<typeof updatePipelineStageSchema>;
