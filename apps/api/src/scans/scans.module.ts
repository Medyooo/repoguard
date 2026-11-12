import { Module } from '@nestjs/common';
import { ScansRepository } from './scans.repository';
import { ScansService } from './scans.service';
import { GithubModule } from '../github/github.module';
import { ScansController } from './scans.controller';

@Module({
  imports: [GithubModule],
  controllers: [ScansController],
  providers: [ScansRepository, ScansService],
  exports: [ScansRepository, ScansService],
})
export class ScansModule {}
