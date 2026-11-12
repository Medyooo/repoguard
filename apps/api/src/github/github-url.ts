import { GITHUB_REPO_URL_REGEX } from '@repoguard/shared';

export interface GithubRepo {
  owner: string;
  repo: string;
}

export function parseGithubUrl(url: string): GithubRepo | null {
  const match = GITHUB_REPO_URL_REGEX.exec(url);
  if (!match) return null;

  const [, owner, rawRepo] = match;
  const repo = rawRepo.replace(/\.git$/, '');

  // La regex accepte "." et "..", qui ne sont pas des noms de dépôt
  if (repo === '' || repo === '.' || repo === '..') return null;

  return { owner, repo };
}
