import { Module } from '@nestjs/common';
import { ScansRepository } from './scans.repository';

@Module({
  providers: [ScansRepository],
  exports: [ScansRepository],
})
export class ScansModule {}
