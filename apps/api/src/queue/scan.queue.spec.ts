import type { Queue } from 'bullmq';
import { SCAN_JOB, type ScanJobData } from './queue.constants';
import { ScanQueue } from './scan.queue';

describe('ScanQueue', () => {
  it('ajoute un job dont l’identifiant est le scanId', async () => {
    const queue = { add: jest.fn().mockResolvedValue(undefined) };
    await new ScanQueue(queue as unknown as Queue<ScanJobData>).enqueue(
      'scan-1',
    );
    expect(queue.add).toHaveBeenCalledWith(
      SCAN_JOB,
      { scanId: 'scan-1' },
      { jobId: 'scan-1' },
    );
  });

  it('propage une panne de Redis', async () => {
    const boom = new Error('redis down');
    const queue = { add: jest.fn().mockRejectedValue(boom) };
    await expect(
      new ScanQueue(queue as unknown as Queue<ScanJobData>).enqueue('x'),
    ).rejects.toBe(boom);
  });
});
