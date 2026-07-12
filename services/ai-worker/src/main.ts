import { randomUUID } from 'node:crypto';
import { MockLlmProvider } from './providers/mock-llm.provider';
import { AiJobProcessor } from './job-processor';
import type { AiJob } from './types';

async function main(): Promise<void> {
  const processor = new AiJobProcessor(new MockLlmProvider());
  const job: AiJob = {
    jobId: process.argv[2] ?? randomUUID(),
    lectureId: process.argv[3] ?? randomUUID(),
    jobType: (process.argv[4] as AiJob['jobType']) ?? 'LECTURE_SUMMARY',
    transcript:
      'Willkommen zur Vorlesung über Bioethik. Wir beginnen mit den vier Prinzipien. Autonomie respektiert die Entscheidung der Patientin.',
    lectureTitle: 'Principles of Bioethics',
  };
  const result = await processor.process(job);
  // eslint-disable-next-line no-console
  console.log('[ai-worker] result:', JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
