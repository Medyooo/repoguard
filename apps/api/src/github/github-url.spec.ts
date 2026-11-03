import { parseGithubUrl } from './github-url';

describe('parseGithubUrl', () => {
  it('extrait owner et repo', () => {
    expect(parseGithubUrl('https://github.com/expressjs/express')).toEqual({
      owner: 'expressjs',
      repo: 'express',
    });
  });

  it('accepte un slash final', () => {
    expect(parseGithubUrl('https://github.com/expressjs/express/')).toEqual({
      owner: 'expressjs',
      repo: 'express',
    });
  });

  it('retire le suffixe .git', () => {
    expect(parseGithubUrl('https://github.com/expressjs/express.git')).toEqual({
      owner: 'expressjs',
      repo: 'express',
    });
  });

  it.each([
    'http://github.com/a/b',
    'https://github.com.evil.com/a/b',
    'https://evil.com/github.com/a/b',
    'https://github.com/a',
    'https://github.com/a/b/c',
    'https://github.com/a/b?x=1',
    'https://github.com/a/..',
    'https://github.com/a/.',
    'https://github.com/a/.git',
    'git@github.com:a/b.git',
    'file:///etc/passwd',
    'https://169.254.169.254/',
  ])('refuse %s', (url) => {
    expect(parseGithubUrl(url)).toBeNull();
  });
});
