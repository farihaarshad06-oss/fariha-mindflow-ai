import type { LlmProvider, LlmRequest, LlmResponse } from '../types';

/**
 * Azure OpenAI adapter skeleton. A real implementation would call the
 * chat completions endpoint using AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY
 * / AZURE_OPENAI_DEPLOYMENT. Not wired to live credentials in Phase 1.
 */
export class AzureOpenAiProvider implements LlmProvider {
  readonly name = 'azure-openai';

  constructor(
    private readonly endpoint: string | undefined,
    private readonly apiKey: string | undefined,
    private readonly deployment: string | undefined,
  ) {}

  async generate(_request: LlmRequest): Promise<LlmResponse> {
    if (!this.endpoint || !this.apiKey || !this.deployment) {
      throw new Error('Azure OpenAI is not configured (AZURE_OPENAI_*).');
    }
    throw new Error('AzureOpenAiProvider is not implemented in Phase 1.');
  }
}

/**
 * Optional OpenAI adapter interface for a future drop-in implementation.
 */
export interface OpenAiProvider extends LlmProvider {
  readonly name: 'openai';
}
