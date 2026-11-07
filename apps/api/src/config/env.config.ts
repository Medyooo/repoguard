import { z } from 'zod';

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  GITHUB_TOKEN: z.string().min(1).optional(),
  MAX_REPO_SIZE_MB: z.coerce.number().int().positive().default(100),
  CACHE_TTL_HOURS: z.preprocess(emptyToUndefined, z.coerce
    .number()
    .nonnegative()
    .max(24 * 30)
    .default(24),
  ),
});

export type Env = z.infer<typeof envSchema>;
