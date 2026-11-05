import { ConfigService } from '@nestjs/config';
import { GithubClient } from './github.client';

const SHA = 'a'.repeat(40);

const makeConfig = (token?: string, maxMb = 100) =>
  ({
    get: (key: string) => (key === 'GITHUB_TOKEN' ? token : undefined),
    getOrThrow: () => maxMb,
  }) as unknown as ConfigService;

const repoBody = (over = {}) => ({
  name: 'express',
  owner: { login: 'expressjs' },
  private: false,
  size: 1000,
  default_branch: 'master',
  ...over,
});

function respond(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) {
  return jest
    .spyOn(global, 'fetch')
    .mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status, headers }),
    );
}

describe('GithubClient', () => {
  const client = new GithubClient(makeConfig());
  const ref = { owner: 'expressjs', repo: 'express' };

  afterEach(() => jest.restoreAllMocks());

  describe('cas normal', () => {
    it('renvoie les infos du dépôt et le SHA du commit', async () => {
      respond(repoBody());
      respond({ sha: SHA });
      await expect(client.getRepoInfo(ref)).resolves.toEqual({
        owner: 'expressjs',
        repo: 'express',
        defaultBranch: 'master',
        commitSha: SHA,
        sizeKb: 1000,
      });
    });

    it('renvoie la casse officielle de GitHub', async () => {
      respond(repoBody());
      respond({ sha: SHA });
      const info = await client.getRepoInfo({
        owner: 'EXPRESSJS',
        repo: 'Express',
      });
      expect(info.owner).toBe('expressjs');
      expect(info.repo).toBe('express');
    });

    it('appelle uniquement les deux bonnes URLs', async () => {
      const spy = respond(repoBody());
      respond({ sha: SHA });
      await client.getRepoInfo(ref);
      expect(spy.mock.calls[0][0]).toBe(
        'https://api.github.com/repos/expressjs/express',
      );
      expect(spy.mock.calls[1][0]).toBe(
        'https://api.github.com/repos/expressjs/express/commits/HEAD',
      );
    });
  });

  describe('refus métier', () => {
    it('refuse un dépôt introuvable', async () => {
      respond({}, 404);
      await expect(client.getRepoInfo(ref)).rejects.toMatchObject({
        response: { type: 'repo_not_found', status: 404 },
      });
    });

    it('refuse un dépôt privé', async () => {
      respond(repoBody({ private: true }));
      await expect(client.getRepoInfo(ref)).rejects.toMatchObject({
        response: { type: 'repo_private', status: 403 },
      });
    });

    it('accepte un dépôt pile à la limite de taille', async () => {
      respond(repoBody({ size: 100 * 1024 }));
      respond({ sha: SHA });
      await expect(client.getRepoInfo(ref)).resolves.toMatchObject({
        sizeKb: 100 * 1024,
      });
    });

    it('refuse un dépôt 1 Ko au-dessus de la limite', async () => {
      respond(repoBody({ size: 100 * 1024 + 1 }));
      await expect(client.getRepoInfo(ref)).rejects.toMatchObject({
        response: { type: 'repo_too_large', status: 413 },
      });
    });

    it('ne demande pas le commit d’un dépôt refusé', async () => {
      const spy = respond(repoBody({ size: 200 * 1024 }));
      await expect(client.getRepoInfo(ref)).rejects.toBeDefined();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('pannes de GitHub', () => {
    it('traduit un réseau coupé en 502', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockRejectedValueOnce(new TypeError('fetch failed'));
      await expect(client.getRepoInfo(ref)).rejects.toMatchObject({
        response: { type: 'github_unavailable', status: 502 },
      });
    });

    it('traduit un timeout en 504', async () => {
      const timeout = Object.assign(new Error('timeout'), {
        name: 'TimeoutError',
      });
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(timeout);
      await expect(client.getRepoInfo(ref)).rejects.toMatchObject({
        response: { type: 'github_unavailable', status: 504 },
      });
    });

    it('signale la limite de requêtes (429)', async () => {
      respond({}, 429);
      await expect(client.getRepoInfo(ref)).rejects.toMatchObject({
        response: { type: 'rate_limited', status: 429 },
      });
    });

    it('signale le quota épuisé (403 avec quota à 0)', async () => {
      respond({}, 403, { 'x-ratelimit-remaining': '0' });
      await expect(client.getRepoInfo(ref)).rejects.toMatchObject({
        response: { type: 'rate_limited' },
      });
    });

    it.each([301, 403, 500, 503])(
      'traduit un statut %i en github_unavailable',
      async (status) => {
        respond({}, status);
        await expect(client.getRepoInfo(ref)).rejects.toMatchObject({
          response: { type: 'github_unavailable', status: 502 },
        });
      },
    );

    it('refuse un corps qui n’est pas du JSON', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce(new Response('pas du json', { status: 200 }));
      await expect(client.getRepoInfo(ref)).rejects.toMatchObject({
        response: { type: 'github_unavailable' },
      });
    });

    it('refuse une réponse au mauvais format', async () => {
      respond({ name: 'express' });
      await expect(client.getRepoInfo(ref)).rejects.toMatchObject({
        response: { type: 'github_unavailable' },
      });
    });

    it('refuse un SHA invalide', async () => {
      respond(repoBody());
      respond({ sha: 'pas-un-sha' });
      await expect(client.getRepoInfo(ref)).rejects.toMatchObject({
        response: { type: 'github_unavailable' },
      });
    });
  });

  describe('sécurité', () => {
    it('envoie le token à api.github.com, sans suivre de redirection', async () => {
      const secured = new GithubClient(makeConfig('secret-token'));
      const spy = respond(repoBody());
      respond({ sha: SHA });
      await secured.getRepoInfo(ref);

      for (const [url, init] of spy.mock.calls) {
        expect(String(url)).toMatch(/^https:\/\/api\.github\.com\//);
        expect((init as RequestInit).headers).toMatchObject({
          Authorization: 'Bearer secret-token',
        });
        expect(init).toMatchObject({ redirect: 'manual' });
      }
    });

    it('n’envoie pas d’en-tête Authorization sans token', async () => {
      const spy = respond(repoBody());
      respond({ sha: SHA });
      await client.getRepoInfo(ref);

      for (const [, init] of spy.mock.calls) {
        expect((init as RequestInit).headers).not.toHaveProperty(
          'Authorization',
        );
      }
    });

    it('ne met jamais le token dans une erreur', async () => {
      const secured = new GithubClient(makeConfig('secret-token'));
      respond({}, 500);
      const err = await secured.getRepoInfo(ref).catch((e) => e);
      expect(JSON.stringify(err.response)).not.toContain('secret-token');
    });

    it('ne peut pas remonter l’arborescence avec un owner malveillant', async () => {
      const spy = respond({}, 404);
      await client
        .getRepoInfo({ owner: 'a/../b', repo: 'x' })
        .catch(() => undefined);
      const url = String(spy.mock.calls[0][0]);
      expect(url).not.toContain('/../');
      expect(url).toBe('https://api.github.com/repos/a%2F..%2Fb/x');
    });
  });
});
