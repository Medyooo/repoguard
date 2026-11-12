import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export const PG_POOL = Symbol('PG_POOL');
export const DRIZZLE = Symbol('DRIZZLE');
export type Database = NodePgDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
       const pool = new Pool({
         connectionString: configService.getOrThrow<string>('DATABASE_URL'),
         connectionTimeoutMillis: 3000,
       })

        const logger = new Logger('Database');
        pool.on('error', (err) => {
          logger.error(`Connexion Postgres perdue : ${err.message}`)
        })

       return pool
      },
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool): Database => drizzle(pool, { schema }),
    },
  ],
  exports: [PG_POOL, DRIZZLE],
})
export class DatabaseModule {}