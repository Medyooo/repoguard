import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';


export const PG_POOL = Symbol('PG_POOL');

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
  ],
  exports: [PG_POOL],
})
export class DatabaseModule {}