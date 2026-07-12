import { LECTURE_STATES } from '@mindflow/types';

const EXPECTED = [
  'DRAFT',
  'RECORDING',
  'UPLOADING',
  'UPLOADED',
  'QUEUED',
  'TRANSCRIBING',
  'TRANSCRIBED',
  'ANALYZING',
  'READY',
  'FAILED',
  'DELETED',
];

describe('Lecture states', () => {
  it('contains all required lifecycle states', () => {
    for (const state of EXPECTED) {
      expect(LECTURE_STATES).toContain(state);
    }
  });
});
