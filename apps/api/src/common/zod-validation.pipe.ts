import { createZodValidationPipe } from 'nestjs-zod';
import { ApiError } from './api-error';
import { PipeTransform, Type } from '@nestjs/common';

type Issue = { path: PropertyKey[]; message: string };

function hasIssues(error: unknown): error is { issues: Issue[] } {
  return (
    typeof error === 'object' &&
    error !== null &&
    Array.isArray((error as { issues?: unknown }).issues)
  );
}

function formatIssues(error: unknown): string {
  if (!hasIssues(error)) return 'Données invalides';
  return error.issues
    .map((i) => `${i.path.map(String).join('.') || 'corps'} : ${i.message}`)
    .join(' ; ');
}

export const AppZodValidationPipe : Type<PipeTransform> = createZodValidationPipe({
  createValidationException: (error: unknown) =>
    new ApiError(
      'invalid_request',
      'Requête invalide',
      400,
      formatIssues(error),
    ),
});
