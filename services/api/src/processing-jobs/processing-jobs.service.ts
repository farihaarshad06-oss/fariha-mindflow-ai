import { Injectable } from '@nestjs/common';
import type { ProcessingJob } from '@mindflow/types';
import { ProcessingJobsRepository } from '../core/repositories';

@Injectable()
export class ProcessingJobsService {
  constructor(private readonly jobs: ProcessingJobsRepository) {}

  list(): ProcessingJob[] {
    return this.jobs.list().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  getById(id: string): ProcessingJob | undefined {
    return this.jobs.findById(id);
  }

  create(input: Omit<ProcessingJob, 'id' | 'createdAt' | 'updatedAt'>): ProcessingJob {
    return this.jobs.create(input);
  }
}
