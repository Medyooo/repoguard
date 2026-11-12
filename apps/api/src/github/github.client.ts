import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { GithubRepo } from './github-url';
import { commitSchema, repoSchema } from './github.schemas';
import { ApiError } from '../common/api-error';

const API = 'https://api.github.com';

export interface RepoInfo {
  owner: string;
  repo: string;
  defaultBranch: string;
  commitSha: string;
  sizeKb: number;
}

export class GithubError extends ApiError {}

@Injectable()
export class GithubClient {
  private readonly token?: string;
  private readonly maxSizeKb: number;

  constructor(config: ConfigService) {
    this.token = config.get<string>('GITHUB_TOKEN');
    this.maxSizeKb = config.getOrThrow<number>('MAX_REPO_SIZE_MB') * 1024;
  }

  async getRepoInfo({ owner, repo }: GithubRepo): Promise<RepoInfo> {
    const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

    const meta = this.parse(repoSchema, await this.get(base));
    if (meta.private) {
      throw new GithubError(
        'repo_private',
        'Dépôt privé',
        403,
        'Seuls les dépôts publics sont analysés',
      );
    }
    if (meta.size > this.maxSizeKb) {
      throw new GithubError(
        'repo_too_large',
        'Dépôt trop volumineux',
        413,
        `Le dépôt fait ${Math.round(meta.size / 1024)} Mo, limite ${Math.round(this.maxSizeKb / 1024)} Mo`,
      );
    }

    const commit = this.parse(
      commitSchema,
      await this.get(`${base}/commits/HEAD`),
    );

    return {
      owner: meta.owner.login,
      repo: meta.name,
      defaultBranch: meta.default_branch,
      commitSha: commit.sha,
      sizeKb: meta.size,
    };
  }

  private async get(path: string): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch(`${API}${path}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'repoguard',
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      const timedOut = (error as { name?: string } | null)?.name === 'TimeoutError';
      throw new GithubError(
        'github_unavailable',
        timedOut ? 'GitHub ne répond pas' : 'GitHub injoignable',
        timedOut ? 504 : 502,
        'Réessaie dans un instant',
      );
    }

    if (res.status === 404) {
      throw new GithubError(
        'repo_not_found',
        'Dépôt introuvable',
        404,
        'Le dépôt n’existe pas ou n’est pas public',
      );
    }
    if (
      res.status === 429 ||
      (res.status === 403 && res.headers.get('x-ratelimit-remaining') === '0')
    ) {
      throw new GithubError(
        'rate_limited',
        'Limite GitHub atteinte',
        429,
        'Réessaie plus tard',
      );
    }
    if (!res.ok) {
      throw new GithubError(
        'github_unavailable',
        'Erreur GitHub',
        502,
        `Réponse inattendue (${res.status})`,
      );
    }

    try {
      return await res.json();
    } catch {
      throw new GithubError(
        'github_unavailable',
        'Réponse GitHub illisible',
        502,
        'Format inattendu',
      );
    }
  }

  private parse<T>(schema: z.ZodType<T>, data: unknown): T {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new GithubError(
        'github_unavailable',
        'Réponse GitHub invalide',
        502,
        'Format inattendu',
      );
    }
    return result.data;
  }
}
