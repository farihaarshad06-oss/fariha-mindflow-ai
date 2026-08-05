import { z } from 'zod';

const httpUrl = z.string().url();

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  WEB_PORT: z.coerce.number().int().positive().default(5173),
  ADMIN_PORT: z.coerce.number().int().positive().default(4173),
  API_PORT: z.coerce.number().int().positive().default(3333),

  DATABASE_URL: z.string().min(1).default('postgresql://mindflow:mindflow@localhost:5432/mindflow'),
  POSTGRES_DB: z.string().min(1).default('mindflow'),
  POSTGRES_USER: z.string().min(1).default('mindflow'),
  POSTGRES_PASSWORD: z.string().min(1).default('mindflow'),

  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z.string().min(16).default('dev-access-secret-change-me-please-0123456789'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev-refresh-secret-change-me-please-0123456789'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  COOKIE_DOMAIN: z.string().default('localhost'),

  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:4173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  AZURE_STORAGE_ACCOUNT_NAME: z.string().optional(),
  AZURE_STORAGE_CONTAINER_AUDIO: z.string().default('lecture-audio'),
  AZURE_STORAGE_CONTAINER_DOCUMENTS: z.string().default('course-documents'),
  AZURE_STORAGE_SAS_EXPIRY_MINUTES: z.coerce.number().int().positive().default(15),

  AZURE_SERVICE_BUS_CONNECTION_STRING: z.string().optional(),
  AZURE_SERVICE_BUS_TRANSCRIPTION_QUEUE: z.string().default('transcription-queue'),
  AZURE_SERVICE_BUS_AI_QUEUE: z.string().default('ai-queue'),

  AZURE_SPEECH_KEY: z.string().optional(),
  AZURE_SPEECH_REGION: z.string().optional(),

  AZURE_OPENAI_ENDPOINT: httpUrl.optional().or(z.literal('')),
  AZURE_OPENAI_API_KEY: z.string().optional(),
  AZURE_OPENAI_DEPLOYMENT: z.string().optional(),

  OPENAI_API_KEY: z.string().optional(),

  LLM_PROVIDER: z.enum(['mock', 'azure-openai', 'openai']).default('mock'),
  TRANSCRIPTION_PROVIDER: z.enum(['mock', 'whisper', 'openai']).default('mock'),

  APPLICATIONINSIGHTS_CONNECTION_STRING: z.string().optional(),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  RATE_LIMIT_TTL: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

  VITE_API_URL: z.string().default('http://localhost:3333/api'),
  VITE_APP_NAME: z.string().default('Fariha MindFlow AI'),
  VITE_DEFAULT_LOCALE: z.string().default('de'),
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(input: Record<string, string | undefined> = process.env): AppEnv {
  return envSchema.parse(input);
}
