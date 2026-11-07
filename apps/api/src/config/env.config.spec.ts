import { envSchema } from './env.config';

const valid = {
  DATABASE_URL: 'postgres://postgres:password@localhost:5432/repoguard',
  REDIS_URL: 'redis://localhost:6379',
};

describe('envSchema', () => {
  describe('cas normal', () => {
    it('applique les valeurs par défaut', () => {
      expect(envSchema.parse(valid)).toEqual({
        ...valid,
        NODE_ENV: 'development',
        PORT: 3000,
        MAX_REPO_SIZE_MB: 100,
        CACHE_TTL_HOURS: 24,
      });
    });

    it('convertit les chaînes en nombres', () => {
      const env = envSchema.parse({
        ...valid,
        PORT: '4000',
        MAX_REPO_SIZE_MB: '50',
        CACHE_TTL_HOURS: '12',
      });
      expect(env).toMatchObject({
        PORT: 4000,
        MAX_REPO_SIZE_MB: 50,
        CACHE_TTL_HOURS: 12,
      });
    });

    it('accepte un GITHUB_TOKEN, qui est facultatif', () => {
      expect(
        envSchema.parse({ ...valid, GITHUB_TOKEN: 'ghp_xxx' }).GITHUB_TOKEN,
      ).toBe('ghp_xxx');
      expect(envSchema.parse(valid).GITHUB_TOKEN).toBeUndefined();
    });

    it('ignore les variables inconnues (PATH, HOME...)', () => {
      expect(() =>
        envSchema.parse({ ...valid, PATH: '/usr/bin', HOME: '/home/x' }),
      ).not.toThrow();
    });
  });

  describe('limites du cache', () => {
    it('accepte un TTL de 0 (cache désactivé)', () => {
      expect(
        envSchema.parse({ ...valid, CACHE_TTL_HOURS: '0' }).CACHE_TTL_HOURS,
      ).toBe(0);
    });

    it('accepte un TTL de 720 h, le maximum', () => {
      expect(
        envSchema.parse({ ...valid, CACHE_TTL_HOURS: '720' }).CACHE_TTL_HOURS,
      ).toBe(720);
    });

    it('traite un CACHE_TTL_HOURS vide comme absent', () => {
      expect(
        envSchema.parse({ ...valid, CACHE_TTL_HOURS: '' }).CACHE_TTL_HOURS,
      ).toBe(24);
    });
  });

  describe('valeurs refusées', () => {
    it.each(['DATABASE_URL', 'REDIS_URL'])(
      'refuse une config sans %s',
      (key) => {
        const env: Record<string, string> = { ...valid };
        delete env[key];
        expect(() => envSchema.parse(env)).toThrow();
      },
    );

    it.each([
      ['PORT', '0'],
      ['PORT', '-1'],
      ['PORT', 'abc'],
      ['NODE_ENV', 'prodution'],
      ['DATABASE_URL', 'pas-une-url'],
      ['REDIS_URL', 'pas-une-url'],
      ['MAX_REPO_SIZE_MB', '0'],
      ['MAX_REPO_SIZE_MB', '-5'],
      ['MAX_REPO_SIZE_MB', '1.5'],
      ['MAX_REPO_SIZE_MB', 'abc'],
      ['CACHE_TTL_HOURS', '-1'],
      ['CACHE_TTL_HOURS', '721'],
      ['CACHE_TTL_HOURS', 'abc'],
      ['GITHUB_TOKEN', ''],
    ])('refuse %s = "%s"', (key, value) => {
      expect(() => envSchema.parse({ ...valid, [key]: value })).toThrow();
    });
  });
});
