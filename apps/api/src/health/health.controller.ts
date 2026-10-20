import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HealthIndicatorService} from '@nestjs/terminus';
import { Pool } from 'pg';
import {PG_POOL} from "../database/database.module";


@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly indicator: HealthIndicatorService,
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([()=> this.checkPostgres()])
  }

  private async checkPostgres() {
    const postgres = this.indicator.check('postgres')
    try {
      await this.pool.query('SELECT 1')
      return  postgres.up()
    } catch {
       return postgres.down();
    }
  }
}
