import type { HealthResponse, Course, Lecture, LectureState } from '@mindflow/types';
import { ApiClient } from './http';

export function createHealthClient(client: ApiClient) {
  return {
    get(): Promise<HealthResponse> {
      return client.get<HealthResponse>('/health');
    },
  };
}

export interface CourseClient {
  list(): Promise<Course[]>;
  get(id: string): Promise<Course>;
  create(input: { title: string; description?: string; color?: string }): Promise<Course>;
}

export function createCourseClient(client: ApiClient): CourseClient {
  return {
    list: () => client.get<Course[]>('/courses'),
    get: (id) => client.get<Course>(`/courses/${id}`),
    create: (input) => client.post<Course>('/courses', input),
  };
}

export interface LectureSummaryQuery {
  courseId?: string;
  state?: LectureState;
}

export interface LectureClient {
  list(query?: LectureSummaryQuery): Promise<Lecture[]>;
  get(id: string): Promise<Lecture>;
  create(input: { title: string; courseId?: string; consentAcknowledged: boolean }): Promise<Lecture>;
  remove(id: string): Promise<{ id: string }>;
}

export function createLectureClient(client: ApiClient): LectureClient {
  return {
    list: (query) => client.get<Lecture[]>('/lectures', { params: query as Record<string, string> }),
    get: (id) => client.get<Lecture>(`/lectures/${id}`),
    create: (input) => client.post<Lecture>('/lectures', input),
    remove: (id) => client.delete<{ id: string }>(`/lectures/${id}`),
  };
}
