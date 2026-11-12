import { createScanRequestSchema } from '@repoguard/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export class CreateScanDto extends createZodDto(createScanRequestSchema) {}

export class ScanParamsDto extends createZodDto(
  z.object({ id: z.string().uuid() }),
) {}
