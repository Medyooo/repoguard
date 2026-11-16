import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { SCAN_JOB, SCAN_QUEUE, type ScanJobData } from './queue.constants';

@Injectable()
export class ScanQueue {
  constructor(
    @InjectQueue(SCAN_QUEUE) private readonly queue: Queue<ScanJobData>,
  ) {}

  async enqueue(scanId: string): Promise<void> {
    await this.queue.add(SCAN_JOB, { scanId }, { jobId: scanId });
  }
}
