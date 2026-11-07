import { Module } from '@nestjs/common';
import { ScansRepository } from './scans.repository';
import { ScansService } from './scans.service';
import { GithubModule } from '../github/github.module';

@Module({
  imports: [GithubModule],
  providers: [ScansRepository, ScansService],
  exports: [ScansRepository, ScansService],
})
export class ScansModule {}
