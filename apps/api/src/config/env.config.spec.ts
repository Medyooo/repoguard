import { envSchema } from './env.config';

describe('envSchema', () => {
  const valid = {
    DATABASE_URL: 'postgres://postgres:password@localhost:5432/repoguard',
    REDIS_URL: 'redis://localhost:6379',
  };

  it('accepte une config valide et applique les valeurs par défaut', () => {
    const env = envSchema.parse(valid);
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('convertit PORT en nombre', () => {
    expect(envSchema.parse({ ...valid, PORT: '4000' }).PORT).toBe(4000);
  });

  it('refuse une config sans DATABASE_URL', () => {
    expect(() => envSchema.parse({ REDIS_URL: valid.REDIS_URL })).toThrow();
  });

  it('refuse un NODE_ENV inconnu', () => {
    expect(() =>
      envSchema.parse({ ...valid, NODE_ENV: 'prodution' }),
    ).toThrow();
  });
});
