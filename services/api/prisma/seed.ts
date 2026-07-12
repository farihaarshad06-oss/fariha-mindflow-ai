/**
 * Development-only seed used with a Prisma-backed database.
 *
 * This script is intentionally isolated from the running API and only executed
 * manually via `pnpm --filter @mindflow/api db:seed`. It demonstrates the
 * canonical entities for local development and MUST NOT run in production with
 * real user data.
 */
import { randomUUID } from 'node:crypto';

const DEMO_PASSWORD = 'development-only-not-for-production';

interface DemoData {
  userId: string;
  courseId: string;
  lectureId: string;
}

function buildDemoData(): DemoData {
  return {
    userId: randomUUID(),
    courseId: randomUUID(),
    lectureId: randomUUID(),
  };
}

export function demoPayload(data: DemoData) {
  return {
    user: {
      id: data.userId,
      email: 'demo.student@mindflow.local',
      fullName: 'Demo Student',
      passwordNote: `Hash of "${DEMO_PASSWORD}" before inserting via Prisma.`,
    },
    course: {
      id: data.courseId,
      ownerId: data.userId,
      title: 'Introduction to Medical Ethics',
    },
    lecture: {
      id: data.lectureId,
      courseId: data.courseId,
      ownerId: data.userId,
      title: 'Lecture 1: Principles of Bioethics',
    },
    transcript: [
      { index: 0, text: 'Welcome to the course on bioethics.', timestampStart: 0, timestampEnd: 4 },
      { index: 1, text: 'We begin with the four principles.', timestampStart: 4, timestampEnd: 9 },
    ],
    summary: 'This lecture introduces the four principles of bioethics.',
    flashcards: [
      { question: 'Name the four principles.', answer: 'Autonomy, beneficence, non-maleficence, justice.' },
    ],
  };
}

async function main(): Promise<void> {
  const data = buildDemoData();
  const payload = demoPayload(data);
  // eslint-disable-next-line no-console
  console.log('Generated development seed payload:', JSON.stringify(payload, null, 2));
  console.log('Note: insert via Prisma client against DATABASE_URL. Password is development-only.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
