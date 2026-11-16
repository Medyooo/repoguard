import { parseRedisUrl } from './redis-connection';

describe('parseRedisUrl', () => {
  it('lit hôte et port', () => {
    expect(parseRedisUrl('redis://localhost:6379')).toEqual({
      host: 'localhost',
      port: 6379,
    });
  });

  it('prend le port 6379 par défaut', () => {
    expect(parseRedisUrl('redis://cache.internal')).toEqual({
      host: 'cache.internal',
      port: 6379,
    });
  });

  it('lit utilisateur, mot de passe décodé et base', () => {
    expect(parseRedisUrl('redis://user:p%40ss@host:6380/2')).toEqual({
      host: 'host',
      port: 6380,
      username: 'user',
      password: 'p@ss',
      db: 2,
    });
  });

  it('ignore un simple slash final', () => {
    expect(parseRedisUrl('redis://host/')).toEqual({
      host: 'host',
      port: 6379,
    });
  });

  it('active TLS pour rediss://', () => {
    expect(parseRedisUrl('rediss://host:6380')).toMatchObject({ tls: {} });
  });

  it('refuse un autre protocole sans écrire l’URL dans l’erreur', () => {
    expect(() => parseRedisUrl('http://user:secret@host')).toThrow('redis://');
    expect(() => parseRedisUrl('http://user:secret@host')).not.toThrow(
      /secret/,
    );
  });
});
