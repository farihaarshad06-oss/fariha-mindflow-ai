import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import type { Lecture } from '@mindflow/types';
import { LecturesRepository, type StoredLecture } from '../core/repositories';

@Injectable()
export class LecturesService {
  constructor(private readonly lectures: LecturesRepository) {}

  listForOwner(ownerId: string): Lecture[] {
    return this.lectures
      .listByOwner(ownerId)
      .filter((lecture) => lecture.state !== 'DELETED')
      .map((lecture) => this.strip(lecture));
  }

  getForOwner(id: string, ownerId: string): Lecture {
    const lecture = this.lectures.findById(id);
    if (!lecture) throw new NotFoundException('Lecture not found.');
    if (lecture.ownerId !== ownerId) throw new ForbiddenException('Access denied.');
    return this.strip(lecture);
  }

  create(
    input: { title: string; courseId?: string; consentAcknowledged: boolean },
    ownerId: string,
  ): Lecture {
    if (!input.consentAcknowledged) {
      throw new BadRequestException('Recording consent must be acknowledged before creating a lecture.');
    }
    const lecture = this.lectures.create({
      title: input.title,
      courseId: input.courseId,
      ownerId,
      state: 'DRAFT',
      consentAcknowledged: input.consentAcknowledged,
    });
    return this.strip(lecture);
  }

  remove(id: string, ownerId: string): { id: string } {
    const lecture = this.lectures.findById(id);
    if (!lecture) throw new NotFoundException('Lecture not found.');
    if (lecture.ownerId !== ownerId) throw new ForbiddenException('Access denied.');
    lecture.state = 'DELETED';
    this.lectures.save(lecture);
    return { id };
  }

  private strip(lecture: StoredLecture): Lecture {
    const { consentAcknowledged: _consent, transcript: _transcript, ...rest } = lecture;
    void _consent;
    void _transcript;
    return rest;
  }
}
