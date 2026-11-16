import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseRedisUrl } from './redis-connection';
import { SCAN_QUEUE } from './queue.constants';
import { ScanQueue } from './scan.queue';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: parseRedisUrl(config.getOrThrow<string>('REDIS_URL')),
        defaultJobOptions: { removeOnComplete: 1000, removeOnFail: 5000 },
      }),
    }),
    BullModule.registerQueue({ name: SCAN_QUEUE }),
  ],
  providers: [ScanQueue],
  exports: [ScanQueue],
})
export class QueueModule {}
