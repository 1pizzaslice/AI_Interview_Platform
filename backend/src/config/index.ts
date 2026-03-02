import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  LLM_PROVIDER: z.enum(['claude', 'mock']).default('mock'),
  STT_PROVIDER: z.enum(['deepgram', 'mock']).default('mock'),
  TTS_PROVIDER: z.enum(['deepgram', 'elevenlabs', 'mock']).default('mock'),
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-4-6'),

  DEEPGRAM_API_KEY: z.string().optional(),

  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET_NAME: z.string().optional(),

  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE_MB: z.coerce.number().default(10),

  SESSION_TIMEOUT_SECONDS: z.coerce.number().default(900),
  ANSWER_TIMEOUT_SECONDS: z.coerce.number().default(90),
  ANSWER_FOLLOWUP_TIMEOUT_SECONDS: z.coerce.number().default(60),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  SENTRY_DSN: z.string().optional(),
});

function validateConfig() {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment configuration:');
    console.error(result.error.flatten().fieldErrors);
    process.exit(1);
  }

  if (result.data.LLM_PROVIDER === 'claude' && !result.data.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is required when LLM_PROVIDER=claude');
    process.exit(1);
  }

  if (
    (result.data.STT_PROVIDER === 'deepgram' || result.data.TTS_PROVIDER === 'deepgram') &&
    !result.data.DEEPGRAM_API_KEY
  ) {
    console.error('DEEPGRAM_API_KEY is required when STT_PROVIDER=deepgram or TTS_PROVIDER=deepgram');
    process.exit(1);
  }

  if (result.data.STORAGE_PROVIDER === 's3') {
    const s3Fields = ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'S3_BUCKET_NAME'] as const;
    for (const field of s3Fields) {
      if (!result.data[field]) {
        console.error(`${field} is required when STORAGE_PROVIDER=s3`);
        process.exit(1);
      }
    }
  }

  return result.data;
}

export const config = validateConfig();
export type Config = typeof config;
