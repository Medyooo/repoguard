import type { ConfigService } from '@nestjs/config';
import type { GithubClient } from '../github/github.client';
import type { Scan, ScansRepository } from './scans.repository';
import { ScansService } from './scans.service';

const NOW = new Date('2026-11-07T12:00:00Z').getTime();
const HOUR = 60 * 60 * 1000;
const SHA = 'a'.repeat(40);

const URL_OK = 'https://github.com/Expressjs/Express'; // casse différente de GitHub
const info = {
  owner: 'expressjs',
  repo: 'express',
  defaultBranch: 'master',
  commitSha: SHA,
  sizeKb: 1000,
};
const ref = { owner: 'expressjs', repo: 'express', commitSha: SHA };
const row = { id: 'scan-1', status: 'queued', ...ref } as unknown as Scan;
const done = { ...row, status: 'completed' } as unknown as Scan;

function setup(ttlHours = 24) {
  const scans = {
    create: jest.fn(),
    findById: jest.fn(),
    findRecentCompleted: jest.fn(),
  };
  const github = { getRepoInfo: jest.fn() };
  const config = { getOrThrow: jest.fn().mockReturnValue(ttlHours) };
  const service = new ScansService(
    scans as unknown as ScansRepository,
    github as unknown as GithubClient,
    config as unknown as ConfigService,
  );
  return { service, scans, github, config };
}

// Cas de base : GitHub répond, aucun scan récent, la création réussit
function happyPath(ttlHours?: number) {
  const ctx = setup(ttlHours);
  ctx.github.getRepoInfo.mockResolvedValue(info);
  ctx.scans.findRecentCompleted.mockResolvedValue(undefined);
  ctx.scans.create.mockResolvedValue(row);
  return ctx;
}

const sinceOf = (scans: { findRecentCompleted: jest.Mock }) =>
  scans.findRecentCompleted.mock.calls[0][1] as Date;

describe('ScansService', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => jest.restoreAllMocks());

  describe('create › cas normal', () => {
    it('crée un scan quand aucun résultat récent n’existe', async () => {
      const { service, scans } = happyPath();

      const result = await service.create(URL_OK);

      expect(result.cached).toBe(false);
      expect(result.scan).toBe(row);
      expect(scans.create).toHaveBeenCalledWith(ref);
    });

    it('renvoie le scan existant sans en créer un autre', async () => {
      const { service, scans, github } = setup();
      github.getRepoInfo.mockResolvedValue(info);
      scans.findRecentCompleted.mockResolvedValue(done);

      const result = await service.create(URL_OK);

      expect(result).toEqual({ scan: done, cached: true });
      expect(scans.create).not.toHaveBeenCalled();
    });

    it('interroge GitHub avec le owner et le repo extraits de l’URL', async () => {
      const { service, github } = happyPath();
      await service.create(URL_OK);
      expect(github.getRepoInfo).toHaveBeenCalledWith({
        owner: 'Expressjs',
        repo: 'Express',
      });
    });

    it('retire le suffixe .git avant d’interroger GitHub', async () => {
      const { service, github } = happyPath();
      await service.create('https://github.com/expressjs/express.git');
      expect(github.getRepoInfo).toHaveBeenCalledWith({
        owner: 'expressjs',
        repo: 'express',
      });
    });

    it('utilise la casse officielle et le SHA de GitHub, pas ceux de l’URL', async () => {
      const { service, scans } = happyPath();

      await service.create(URL_OK);

      expect(scans.findRecentCompleted.mock.calls[0][0]).toEqual(ref);
      expect(scans.create).toHaveBeenCalledWith(ref);
    });
  });

  describe('create › fenêtre de cache', () => {
    it('regarde les dernières 24 h par défaut', async () => {
      const { service, scans } = happyPath();
      await service.create(URL_OK);
      expect(sinceOf(scans)).toEqual(new Date(NOW - 24 * HOUR));
    });

    it('utilise le TTL configuré (1 h)', async () => {
      const { service, scans } = happyPath(1);
      await service.create(URL_OK);
      expect(sinceOf(scans)).toEqual(new Date(NOW - HOUR));
    });

    it('avec un TTL de 0, la fenêtre est nulle (cache désactivé)', async () => {
      const { service, scans } = happyPath(0);
      await service.create(URL_OK);
      expect(sinceOf(scans)).toEqual(new Date(NOW));
    });

    it('accepte un TTL décimal (0,5 h = 30 min)', async () => {
      const { service, scans } = happyPath(0.5);
      await service.create(URL_OK);
      expect(sinceOf(scans)).toEqual(new Date(NOW - 30 * 60 * 1000));
    });
  });

  describe('create › refus', () => {
    it.each([
      'https://evil.com/a/b',
      'http://github.com/a/b',
      'https://github.com/a',
      'https://github.com/a/..',
      '',
    ])('refuse l’URL "%s" sans rien appeler', async (url) => {
      const { service, scans, github } = setup();

      await expect(service.create(url)).rejects.toMatchObject({
        response: { type: 'invalid_repo_url', status: 400 },
      });

      expect(github.getRepoInfo).not.toHaveBeenCalled();
      expect(scans.findRecentCompleted).not.toHaveBeenCalled();
      expect(scans.create).not.toHaveBeenCalled();
    });

    it('propage le refus de GitHub sans toucher à la base', async () => {
      const { service, scans, github } = setup();
      const refusal = new Error('repo_not_found');
      github.getRepoInfo.mockRejectedValue(refusal);

      await expect(service.create(URL_OK)).rejects.toBe(refusal);

      expect(scans.findRecentCompleted).not.toHaveBeenCalled();
      expect(scans.create).not.toHaveBeenCalled();
    });
  });

  describe('create › pannes de la base', () => {
    it('propage une panne à la lecture du cache, sans rien créer', async () => {
      const { service, scans, github } = setup();
      const boom = new Error('db down');
      github.getRepoInfo.mockResolvedValue(info);
      scans.findRecentCompleted.mockRejectedValue(boom);

      await expect(service.create(URL_OK)).rejects.toBe(boom);
      expect(scans.create).not.toHaveBeenCalled();
    });

    it('propage une panne à la création', async () => {
      const { service, scans, github } = setup();
      const boom = new Error('insert failed');
      github.getRepoInfo.mockResolvedValue(info);
      scans.findRecentCompleted.mockResolvedValue(undefined);
      scans.create.mockRejectedValue(boom);

      await expect(service.create(URL_OK)).rejects.toBe(boom);
    });
  });

  describe('create › ordre des appels', () => {
    it('interroge GitHub, puis le cache, puis crée', async () => {
      const { service, scans, github } = happyPath();

      await service.create(URL_OK);

      const order = (fn: jest.Mock) => fn.mock.invocationCallOrder[0];
      expect(order(github.getRepoInfo)).toBeLessThan(
        order(scans.findRecentCompleted),
      );
      expect(order(scans.findRecentCompleted)).toBeLessThan(
        order(scans.create),
      );
    });

    it.todo('ne crée pas deux scans pour le même commit lancés en parallèle');
  });

  describe('démarrage', () => {
    it('échoue immédiatement si CACHE_TTL_HOURS manque', () => {
      const config = {
        getOrThrow: () => {
          throw new Error('CACHE_TTL_HOURS manquante');
        },
      };
      expect(
        () =>
          new ScansService(
            {} as unknown as ScansRepository,
            {} as unknown as GithubClient,
            config as unknown as ConfigService,
          ),
      ).toThrow('CACHE_TTL_HOURS');
    });
  });

  describe('get', () => {
    it('renvoie le scan trouvé, en cherchant avec l’id demandé', async () => {
      const { service, scans } = setup();
      scans.findById.mockResolvedValue(row);

      await expect(service.get('scan-1')).resolves.toBe(row);
      expect(scans.findById).toHaveBeenCalledWith('scan-1');
    });

    it('renvoie un 404 quand le scan n’existe pas', async () => {
      const { service, scans } = setup();
      scans.findById.mockResolvedValue(undefined);

      await expect(service.get('inconnu')).rejects.toMatchObject({
        response: { type: 'scan_not_found', status: 404 },
      });
    });

    it('ne transforme pas une panne de base en 404', async () => {
      const { service, scans } = setup();
      const boom = new Error('db down');
      scans.findById.mockRejectedValue(boom);

      await expect(service.get('scan-1')).rejects.toBe(boom);
    });
  });
});
