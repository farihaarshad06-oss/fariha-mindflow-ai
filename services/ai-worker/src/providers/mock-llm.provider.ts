import type { LlmProvider, LlmRequest, LlmResponse } from '../types';
import { createHash } from 'node:crypto';

/**
 * Deterministic mock LLM provider. Output is derived from a hash of the prompt
 * so local runs and tests are reproducible without cloud credentials.
 */
export class MockLlmProvider implements LlmProvider {
  readonly name = 'mock';

  async generate(request: LlmRequest): Promise<LlmResponse> {
    const seed = createHash('sha256').update(request.system + request.user).digest('hex');
    const variant = Number.parseInt(seed.slice(0, 2), 16) % 3;
    return {
      content: MOCK_RESPONSES[variant],
      model: 'mock-1',
      finishReason: 'stop',
    };
  }
}

const MOCK_RESPONSES = [
  'This lecture introduces the four principles of bioethics: autonomy, beneficence, non-maleficence and justice. The instructor explains how to apply them to clinical decisions.',
  'Key concepts covered include autonomy (respecting patient choice), beneficence (acting in the patient best interest), and justice (fair distribution of resources).',
  'Summary: the session contrasts deontological and consequentialist reasoning, then applies both frameworks to a case study on informed consent.',
];
