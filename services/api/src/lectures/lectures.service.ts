import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import type { Lecture } from '@mindflow/types';
import { LecturesRepository, type StoredLecture } from '../core/repositories';

@Injectable()
export class LecturesService {
  constructor(private readonly lectures: LecturesRepository) {}

  async listForOwner(ownerId: string): Promise<Lecture[]> {
    const lectures = await this.lectures.listByOwner(ownerId);
    return lectures.filter((lecture) => lecture.state !== 'DELETED').map((lecture) => this.strip(lecture));
  }

  async getForOwner(id: string, ownerId: string): Promise<Lecture> {
    const lecture = await this.lectures.findById(id);
    if (!lecture) throw new NotFoundException('Lecture not found.');
    if (lecture.ownerId !== ownerId) throw new ForbiddenException('Access denied.');
    return this.strip(lecture);
  }

  async create(input: { title: string; courseId?: string; consentAcknowledged: boolean }, ownerId: string): Promise<Lecture> {
    if (!input.consentAcknowledged) {
      throw new BadRequestException('Recording consent must be acknowledged before creating a lecture.');
    }
    const lecture = await this.lectures.create({
      title: input.title,
      courseId: input.courseId,
      ownerId,
      state: 'DRAFT',
      consentAcknowledged: input.consentAcknowledged,
    });
    return this.strip(lecture);
  }

  async remove(id: string, ownerId: string): Promise<{ id: string }> {
    const lecture = await this.lectures.findById(id);
    if (!lecture) throw new NotFoundException('Lecture not found.');
    if (lecture.ownerId !== ownerId) throw new ForbiddenException('Access denied.');
    await this.lectures.save({ ...lecture, state: 'DELETED' });
    return { id };
  }

  private strip(lecture: StoredLecture): Lecture {
    const { consentAcknowledged: _consent, transcript: _transcript, ...rest } = lecture;
    void _consent;
    void _transcript;
    return rest;
  }
}
