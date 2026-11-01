import {
  boolean,
  char,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const scanStatus = pgEnum('scan_status', [
  'queued',
  'running',
  'completed',
  'failed',
]);
export const severity = pgEnum('severity', [
  'critical',
  'high',
  'medium',
  'low',
  'info',
]);

export const scans = pgTable(
  'scans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    owner: text('owner').notNull(),
    repo: text('repo').notNull(),
    commitSha: char('commit_sha', { length: 40 }),
    status: scanStatus('status').notNull().default('queued'),
    score: smallint('score'),
    errorMessage: text('error_message'),
    stats: jsonb('stats'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [
    index('scans_repo_sha_idx').on(t.owner, t.repo, t.commitSha),
    check('scans_score_range', sql`${t.score} BETWEEN 0 AND 100`),
  ],
);

export const dependencyFindings = pgTable(
  'dependency_findings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scanId: uuid('scan_id')
      .notNull()
      .references(() => scans.id, { onDelete: 'cascade' }),
    packageName: text('package_name').notNull(),
    version: text('version').notNull(),
    vulnId: text('vuln_id').notNull(),
    severity: severity('severity').notNull(),
    summary: text('summary'),
    fixedVersion: text('fixed_version'),
    isDirect: boolean('is_direct').notNull(),
  },
  (t) => [index('dependency_findings_scan_id_idx').on(t.scanId)],
);

export const secretFindings = pgTable(
  'secret_findings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scanId: uuid('scan_id')
      .notNull()
      .references(() => scans.id, { onDelete: 'cascade' }),
    ruleId: text('rule_id').notNull(),
    severity: severity('severity').notNull(),
    filePath: text('file_path').notNull(),
    line: integer('line').notNull(),
    redactedMatch: text('redacted_match').notNull(),
    fingerprint: char('fingerprint', { length: 64 }).notNull(),
  },
  (t) => [index('secret_findings_scan_id_idx').on(t.scanId)],
);
