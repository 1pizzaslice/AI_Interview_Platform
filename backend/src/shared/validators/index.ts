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

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type CreateInterviewInput = z.infer<typeof createInterviewSchema>;
export type AntiCheatEventInput = z.infer<typeof antiCheatEventSchema>;
export type AnswerInput = z.infer<typeof answerSchema>;
