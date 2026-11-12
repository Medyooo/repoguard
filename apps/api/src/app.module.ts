import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import {envSchema} from "./config/env.config";
import { AppZodValidationPipe } from './common/zod-validation.pipe';
import { ScansModule } from './scans/scans.module';
import { APP_PIPE } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => envSchema.parse(env),
    }),
    DatabaseModule,
    HealthModule,
    ScansModule,
  ],
  providers: [{provide: APP_PIPE , useClass: AppZodValidationPipe}],
})
export class AppModule {}
