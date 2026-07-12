import type { Course, Lecture } from '@mindflow/types';

export const mockCourses: Course[] = [
  {
    id: 'course-1',
    ownerId: 'user-1',
    title: 'Introduction to Medical Ethics',
    description: 'Foundations of bioethics for healthcare students.',
    color: '#4f46e5',
    nextExamDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 12).toISOString(),
    lectureCount: 8,
    weakTopics: ['Autonomy', 'Justice'],
    progress: 62,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'course-2',
    ownerId: 'user-1',
    title: 'Data Structures',
    description: 'Algorithms and complexity.',
    color: '#0ea5e9',
    nextExamDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
    lectureCount: 14,
    weakTopics: ['Graphs'],
    progress: 48,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const mockLectures: Lecture[] = [
  {
    id: 'lecture-1',
    courseId: 'course-1',
    ownerId: 'user-1',
    title: 'Principles of Bioethics',
    state: 'READY',
    durationSeconds: 1820,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lecture-2',
    courseId: 'course-2',
    ownerId: 'user-1',
    title: 'Trees and Heaps',
    state: 'TRANSCRIBING',
    durationSeconds: 2400,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const mockSummary =
  'This lecture introduces the four principles of bioethics: autonomy, beneficence, non-maleficence and justice. The instructor explains how to apply them in clinical decision-making.';

export const mockTranscript = [
  { id: 'seg-1', text: 'Welcome to the course on bioethics.', start: 0, end: 4 },
  { id: 'seg-2', text: 'We begin with the four principles.', start: 4, end: 9 },
  { id: 'seg-3', text: 'Autonomy means respecting the patient choice.', start: 9, end: 16 },
];

export const mockKeyConcepts = [
  { id: 'kc-1', label: 'Autonomy', description: 'Respecting patient self-determination.' },
  { id: 'kc-2', label: 'Beneficence', description: 'Acting in the patients best interest.' },
];

export const mockFlashcards = [
  { id: 'fc-1', question: 'Name the four principles.', answer: 'Autonomy, beneficence, non-maleficence, justice.' },
];
