import type { Scan } from './scans.repository';

export function toScanResponse(scan: Scan) {
  return {
    id: scan.id,
    status: scan.status,
    repo: { owner: scan.owner, name: scan.repo, commitSha: scan.commitSha },
    score: scan.score,
    error: scan.errorMessage,
    createdAt: scan.createdAt.toISOString(),
    startedAt: scan.startedAt?.toISOString() ?? null,
    finishedAt: scan.finishedAt?.toISOString() ?? null,
  };
}
