import { z } from 'zod';

export const severitySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
export type Severity = z.infer<typeof severitySchema>;

export const scanStatusSchema = z.enum(['queued', 'running', 'completed', 'failed']);
export type ScanStatus = z.infer<typeof scanStatusSchema>;

export const createScanRequestSchema = z.object({
    repoUrl: z
        .string()
        .regex(
            /^https:\/\/github\.com\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}\/?$/,
            'URL GitHub invalide',
        ),
});
export type CreateScanRequest = z.infer<typeof createScanRequestSchema>;