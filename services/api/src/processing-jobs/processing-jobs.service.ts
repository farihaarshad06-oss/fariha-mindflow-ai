import { Injectable } from '@nestjs/common';
import type { ProcessingJob } from '@mindflow/types';
import { ProcessingJobsRepository } from '../core/repositories';

@Injectable()
export class ProcessingJobsService {
  constructor(private readonly jobs: ProcessingJobsRepository) {}

  async list(): Promise<ProcessingJob[]> {
    const jobs = await this.jobs.list();
    return jobs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async getById(id: string): Promise<ProcessingJob | undefined> {
    return this.jobs.findById(id);
  }

  async create(input: Omit<ProcessingJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProcessingJob> {
    return this.jobs.create(input);
  }
}
