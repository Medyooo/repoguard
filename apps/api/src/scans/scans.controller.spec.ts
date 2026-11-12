import type { INestApplication } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ApiError } from '../common/api-error';
import { AppZodValidationPipe } from '../common/zod-validation.pipe';
import { ScansController } from './scans.controller';
import type { Scan } from './scans.repository';
import { ScansService } from './scans.service';

const ID = '3f6c1d2e-8a4b-4c1e-9f0a-2b7d5e6f1a90';
const URL_OK = 'https://github.com/expressjs/express';

const scan = {
  id: ID,
  owner: 'expressjs',
  repo: 'express',
  commitSha: 'a'.repeat(40),
  status: 'queued',
  score: null,
  errorMessage: null,
  stats: null,
  createdAt: new Date('2026-11-07T10:00:00Z'),
  startedAt: null,
  finishedAt: null,
} as unknown as Scan;

describe('ScansController', () => {
  const service = { create: jest.fn(), get: jest.fn() };
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ScansController],
      providers: [
        { provide: ScansService, useValue: service },
        { provide: APP_PIPE, useClass: AppZodValidationPipe },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => jest.resetAllMocks());

  describe('POST /api/scans', () => {
    it('répond 202 pour un nouveau scan', async () => {
      service.create.mockResolvedValue({ scan, cached: false });

      const res = await request(app.getHttpServer())
        .post('/api/scans')
        .send({ repoUrl: URL_OK });

      expect(res.status).toBe(202);
      expect(res.body).toMatchObject({
        id: ID,
        status: 'queued',
        cached: false,
      });
      expect(res.body.links.self).toBe(`/api/scans/${ID}`);
      expect(service.create).toHaveBeenCalledWith(URL_OK);
    });

    it('répond 200 quand le résultat vient du cache', async () => {
      service.create.mockResolvedValue({ scan, cached: true });

      const res = await request(app.getHttpServer())
        .post('/api/scans')
        .send({ repoUrl: URL_OK });

      expect(res.status).toBe(200);
      expect(res.body.cached).toBe(true);
    });

    it.each([
      ['une URL hors GitHub', { repoUrl: 'https://evil.com/a/b' }],
      ['un champ manquant', {}],
      ['un mauvais type', { repoUrl: 42 }],
    ])('répond 400 pour %s, sans appeler le service', async (_nom, body) => {
      const res = await request(app.getHttpServer())
        .post('/api/scans')
        .send(body);

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ type: 'invalid_request', status: 400 });
      expect(service.create).not.toHaveBeenCalled();
    });

    it('répond 400 pour un corps vide', async () => {
      const res = await request(app.getHttpServer()).post('/api/scans');
      expect(res.status).toBe(400);
      expect(service.create).not.toHaveBeenCalled();
    });

    it('nomme le champ fautif sans renvoyer la valeur envoyée', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/scans')
        .send({ repoUrl: 'https://evil.com/valeur-secrete-xyz' });

      expect(res.status).toBe(400);
      expect(res.body.detail).toContain('repoUrl');
      expect(JSON.stringify(res.body)).not.toContain('valeur-secrete-xyz');
    });

    it('relaie l’erreur métier du service avec son code', async () => {
      service.create.mockRejectedValue(
        new ApiError(
          'repo_too_large',
          'Dépôt trop volumineux',
          413,
          'Trop gros',
        ),
      );

      const res = await request(app.getHttpServer())
        .post('/api/scans')
        .send({ repoUrl: URL_OK });

      expect(res.status).toBe(413);
      expect(res.body).toEqual({
        type: 'repo_too_large',
        title: 'Dépôt trop volumineux',
        status: 413,
        detail: 'Trop gros',
      });
    });

    it('ne divulgue pas le détail d’une erreur inattendue', async () => {
      service.create.mockRejectedValue(
        new Error('mot de passe de la base: hunter2'),
      );

      const res = await request(app.getHttpServer())
        .post('/api/scans')
        .send({ repoUrl: URL_OK });

      expect(res.status).toBe(500);
      expect(JSON.stringify(res.body)).not.toContain('hunter2');
    });
  });

  describe('GET /api/scans/:id', () => {
    it('renvoie le scan au format de l’API', async () => {
      service.get.mockResolvedValue(scan);

      const res = await request(app.getHttpServer()).get(`/api/scans/${ID}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: ID,
        status: 'queued',
        repo: { owner: 'expressjs', name: 'express' },
        createdAt: '2026-11-07T10:00:00.000Z',
      });
      expect(service.get).toHaveBeenCalledWith(ID);
    });

    it('répond 400 pour un id qui n’est pas un UUID, sans appeler le service', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/scans/pas-un-uuid',
      );

      expect(res.status).toBe(400);
      expect(res.body.type).toBe('invalid_request');
      expect(service.get).not.toHaveBeenCalled();
    });

    it('répond 404 quand le scan n’existe pas', async () => {
      service.get.mockRejectedValue(
        new ApiError(
          'scan_not_found',
          'Scan introuvable',
          404,
          'Aucun scan avec cet identifiant',
        ),
      );

      const res = await request(app.getHttpServer()).get(`/api/scans/${ID}`);

      expect(res.status).toBe(404);
      expect(res.body.type).toBe('scan_not_found');
    });
  });
});
