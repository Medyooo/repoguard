import { Scan, ScansRepository } from './scans.repository';
import { Injectable, Logger } from '@nestjs/common';
import { GithubClient } from '../github/github.client';
import { parseGithubUrl } from '../github/github-url';
import { ApiError } from '../common/api-error';
import { ConfigService } from '@nestjs/config';
import { ScanQueue } from '../queue/scan.queue';

export  interface CreateScanResult {
  scan : Scan;
  cached: boolean;
}

@Injectable()
export class ScansService {
  private readonly cacheTtlMs: number;
  private readonly logger = new Logger(ScansService.name);

  constructor(
    private readonly scans: ScansRepository,
    private readonly github: GithubClient,
    private readonly queue: ScanQueue,
    config: ConfigService,
  ) {
    this.cacheTtlMs = config.getOrThrow('CACHE_TTL_HOURS') * 60 * 60 * 1000;
  }

  async create(repoUrl: string): Promise<CreateScanResult> {
    const parsed = parseGithubUrl(repoUrl);
    if (!parsed) {
      throw new ApiError(
        'invalid_repo_url',
        'URL GitHub invalide',
        400,
        'Format attendu : https://github.com/owner/repo',
      );
    }

    const info = await this.github.getRepoInfo(parsed);
    const ref = {
      owner: info.owner,
      repo: info.repo,
      commitSha: info.commitSha,
    };

    const since = new Date(Date.now() - this.cacheTtlMs);
    const existing = await this.scans.findRecentCompleted(ref, since);
    if (existing) {
      return { scan: existing, cached: true };
    }

    const scan = await this.scans.create(ref);

    try {
      await this.queue.enqueue(scan.id);
    } catch (error) {
      this.logger.error(
        `Mise en file impossible pour le scan ${scan.id}: ${(error as Error).message}`,
      );
      await this.scans.markFailed(scan.id, 'Impossible de mettre le scan en file');
      throw new ApiError('queue_unavailable', 'Service indisponible', 503, 'Réessaie dans un instant');
    }
    return { scan, cached: false };
  }

  async get(id: string): Promise<Scan> {
    const scan = await this.scans.findById(id);
    if (!scan) {
      throw new ApiError(
        'scan_not_found',
        'Scan introuvable',
        404,
        'Aucun scan avec cet identifiant',
      );
    }
    return scan;
  }
}