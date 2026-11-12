import {scans} from '../database/schema';
import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type Database } from '../database/database.module';
import { and, desc, eq, gte } from 'drizzle-orm';

export type Scan = typeof scans.$inferSelect;

export interface RepoRef {
  owner: string;
  repo: string;
  commitSha: string;
}

@Injectable()
export class ScansRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async create(input: RepoRef): Promise<Scan> {
    const [scan] = await this.db.insert(scans).values(input).returning();
    return scan;
  }

  async findById(id: string): Promise<Scan | undefined> {
    const [scan] = await this.db
      .select()
      .from(scans)
      .where(eq(scans.id, id))
      .limit(1);
    return scan;
  }

  async findRecentCompleted(
    ref: RepoRef,
    since: Date,
  ): Promise<Scan | undefined> {
    const [row] = await this.db
      .select()
      .from(scans)
      .where(
        and(
          eq(scans.owner, ref.owner),
          eq(scans.repo, ref.repo),
          eq(scans.commitSha, ref.commitSha),
          eq(scans.status, 'completed'),
          gte(scans.finishedAt, since),
        ),
      )
      .orderBy(desc(scans.finishedAt))
      .limit(1);
    return row;
  }
}
