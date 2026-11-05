// github.schemas.ts
import { z } from 'zod';

export const repoSchema = z.object({
  name: z.string(),
  owner: z.object({ login: z.string() }),
  private: z.boolean(),
  size: z.number(), // en Ko
  default_branch: z.string(),
});

export const commitSchema = z.object({
  sha: z.string().regex(/^[0-9a-f]{40}$/),
});
