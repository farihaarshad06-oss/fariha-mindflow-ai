/**
 * AiProviders — real HTTP integrations for all supported AI providers.
 *
 * Supported: OpenAI, Azure OpenAI, Gemini, Ollama, LM Studio, generic OpenAI-compat.
 *
 * Security:
 * - API keys retrieved from SecretsService (OS-encrypted) in main process only
 * - Never logged, never returned to renderer, never stored in SQLite
 * - All structured AI output validated with Zod
 * - One bounded repair attempt for invalid structured output
 * - Authorization headers redacted from logs
 *
 * Cost control:
 * - Token estimation before every request
 * - Daily/monthly cost and token limit checks
 * - SHA-256 request hash for deduplication and caching
 * - Usage persisted to AiUsageEvent after every request
 */

import https from 'node:https';
import http from 'node:http';
import crypto from 'node:crypto';
import { z, type ZodTypeAny } from 'zod';
import log from 'electron-log/main';
import { getPrisma } from './database';
import { SecretsService } from './secrets';
import { SettingsService } from './settings';

// ── Types ──────────────────────────────────────────────────────────────────

export type ModelTier = 'economy' | 'balanced' | 'quality';

export interface AiRequestOptions<T extends ZodTypeAny> {
  providerId: string;
  tier?: ModelTier;
  operation: string;
  systemPrompt?: string;
  userPrompt: string;
  responseSchema?: T;
  maxOutputTokens?: number;
  temperature?: number;
  lectureId?: string;
  courseId?: string;
}

export interface AiResponse<T> {
  data: T;
  inputTokens: number;
  outputTokens: number;
  estimatedCostCents: number;
  cacheHit: boolean;
  model: string;
  provider: string;
}

// ── Cost estimation (per 1M tokens) ───────────────────────────────────────

const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 250, output: 1000 },
  'gpt-4o-mini': { input: 15, output: 60 },
  'gpt-4-turbo': { input: 1000, output: 3000 },
  'gpt-3.5-turbo': { input: 50, output: 150 },
  'gemini-1.5-pro': { input: 125, output: 375 },
  'gemini-1.5-flash': { input: 7, output: 30 },
  'gemini-2.0-flash': { input: 10, output: 40 },
  'default': { input: 100, output: 300 },
};

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const key = Object.keys(COST_PER_MILLION).find((k) => model.toLowerCase().includes(k)) ?? 'default';
  const rate = COST_PER_MILLION[key] ?? { input: 100, output: 300 };
  return Math.ceil((inputTokens * rate.input + outputTokens * rate.output) / 1_000_000);
}

// Rough token estimation: ~4 chars per token
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ── Request hash for deduplication ────────────────────────────────────────

function hashRequest(providerId: string, model: string, operation: string, userPrompt: string): string {
  return crypto.createHash('sha256')
    .update(JSON.stringify({ providerId, model, operation, userPrompt }))
    .digest('hex');
}

// ── HTTP helper (no shell, no exec, pure Node HTTP) ───────────────────────

interface HttpOptions {
  method: 'POST' | 'GET';
  url: string;
  headers: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

async function httpRequest(opts: HttpOptions): Promise<{ status: number; body: string }> {
  const { method, url, headers, body, timeoutMs = 30_000, signal } = opts;
  const parsed = new URL(url);
  const isHttps = parsed.protocol === 'https:';
  const proto = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = proto.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method,
        headers: { 'Content-Type': 'application/json', ...headers, ...(body ? { 'Content-Length': Buffer.byteLength(body).toString() } : {}) },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
        res.on('error', reject);
      }
    );

    if (timeoutMs) {
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    }

    if (signal) {
      signal.addEventListener('abort', () => { req.destroy(); reject(new Error('CANCELLED')); });
    }

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ── Provider dispatch ──────────────────────────────────────────────────────

interface ProviderConfig {
  id: string;
  providerType: string;
  baseUrl: string | null;
  modelRouting: { economy?: string; balanced?: string; quality?: string };
}

function resolveModel(routing: ProviderConfig['modelRouting'], tier: ModelTier, providerType: string): string {
  const explicit = routing[tier];
  if (explicit) return explicit;
  // Sensible defaults per provider
  const defaults: Record<string, Record<ModelTier, string>> = {
    openai: { economy: 'gpt-4o-mini', balanced: 'gpt-4o-mini', quality: 'gpt-4o' },
    azure: { economy: 'gpt-4o-mini', balanced: 'gpt-4o-mini', quality: 'gpt-4o' },
    gemini: { economy: 'gemini-1.5-flash', balanced: 'gemini-1.5-flash', quality: 'gemini-1.5-pro' },
    ollama: { economy: 'llama3.2', balanced: 'llama3.2', quality: 'llama3.1:70b' },
    lmstudio: { economy: 'local-model', balanced: 'local-model', quality: 'local-model' },
    'openai-compat': { economy: 'gpt-3.5-turbo', balanced: 'gpt-3.5-turbo', quality: 'gpt-4' },
  };
  return defaults[providerType]?.[tier] ?? 'gpt-4o-mini';
}

async function callOpenAI(opts: {
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
}): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const body = JSON.stringify({
    model: opts.model,
    messages: [
      { role: 'system', content: opts.systemPrompt },
      { role: 'user', content: opts.userPrompt },
    ],
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
  });

  // Redact auth header from logs
  const res = await httpRequest({
    method: 'POST',
    url: `${opts.baseUrl}/chat/completions`,
    headers: { 'Authorization': 'Bearer ' + opts.apiKey },
    body,
    timeoutMs: 60_000,
    signal: opts.signal,
  });

  if (res.status === 401) throw new Error('PROVIDER_AUTH_ERROR: Invalid API key');
  if (res.status === 429) throw new Error('PROVIDER_RATE_LIMIT: Rate limit exceeded');
  if (res.status === 402) throw new Error('PROVIDER_QUOTA: Quota exceeded');
  if (res.status >= 400) throw new Error(`PROVIDER_HTTP_ERROR: HTTP ${res.status}`);

  const json = JSON.parse(res.body) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: { message?: string };
  };

  if (json.error) throw new Error(`PROVIDER_API_ERROR: ${json.error.message ?? 'Unknown error'}`);

  const content = json.choices?.[0]?.message?.content ?? '';
  const inputTokens = json.usage?.prompt_tokens ?? estimateTokens(opts.userPrompt);
  const outputTokens = json.usage?.completion_tokens ?? estimateTokens(content);

  return { content, inputTokens, outputTokens };
}

async function callAzure(opts: {
  apiKey: string;
  endpoint: string;
  deployment: string;
  apiVersion: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
}): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const url = `${opts.endpoint}/openai/deployments/${encodeURIComponent(opts.deployment)}/chat/completions?api-version=${encodeURIComponent(opts.apiVersion)}`;
  const body = JSON.stringify({
    messages: [
      { role: 'system', content: opts.systemPrompt },
      { role: 'user', content: opts.userPrompt },
    ],
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
  });

  const res = await httpRequest({
    method: 'POST',
    url,
    headers: { 'api-key': opts.apiKey },
    body,
    timeoutMs: 60_000,
    signal: opts.signal,
  });

  if (res.status === 401) throw new Error('PROVIDER_AUTH_ERROR: Invalid Azure API key');
  if (res.status === 429) throw new Error('PROVIDER_RATE_LIMIT');
  if (res.status >= 400) throw new Error(`PROVIDER_HTTP_ERROR: HTTP ${res.status}`);

  const json = JSON.parse(res.body) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: { message?: string };
  };

  if (json.error) throw new Error(`PROVIDER_API_ERROR: ${json.error.message ?? ''}`);
  const content = json.choices?.[0]?.message?.content ?? '';
  const inputTokens = json.usage?.prompt_tokens ?? estimateTokens(opts.userPrompt);
  const outputTokens = json.usage?.completion_tokens ?? estimateTokens(content);
  return { content, inputTokens, outputTokens };
}

async function callGemini(opts: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
  signal?: AbortSignal;
}): Promise<{ content: string; inputTokens: number; outputTokens: number }> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent?key=${opts.apiKey}`;
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: `${opts.systemPrompt}\n\n${opts.userPrompt}` }] }],
    generationConfig: { maxOutputTokens: opts.maxTokens, temperature: opts.temperature },
  });

  const res = await httpRequest({ method: 'POST', url, headers: {}, body, timeoutMs: 60_000, signal: opts.signal });

  if (res.status === 400) throw new Error('PROVIDER_INVALID_REQUEST');
  if (res.status === 401 || res.status === 403) throw new Error('PROVIDER_AUTH_ERROR: Invalid Gemini API key');
  if (res.status === 429) throw new Error('PROVIDER_RATE_LIMIT');
  if (res.status >= 400) throw new Error(`PROVIDER_HTTP_ERROR: HTTP ${res.status}`);

  const json = JSON.parse(res.body) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    error?: { message?: string };
  };

  if (json.error) throw new Error(`PROVIDER_API_ERROR: ${json.error.message ?? ''}`);
  const content = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const inputTokens = json.usageMetadata?.promptTokenCount ?? estimateTokens(opts.userPrompt);
  const outputTokens = json.usageMetadata?.candidatesTokenCount ?? estimateTokens(content);
  return { content, inputTokens, outputTokens };
}

// ── Cost/limit guard ───────────────────────────────────────────────────────

async function checkLimits(estimatedInputTokens: number, estimatedOutputTokens: number, model: string): Promise<void> {
  const db = getPrisma();
  const settings = await SettingsService.get();
  const today = new Date(new Date().setHours(0, 0, 0, 0));
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [dailyEvents, monthlyEvents] = await Promise.all([
    db.aiUsageEvent.findMany({ where: { createdAt: { gte: today } } }),
    db.aiUsageEvent.findMany({ where: { createdAt: { gte: monthStart } } }),
  ]);

  const dailyTokens = dailyEvents.reduce((s, e) => s + e.inputTokens + e.outputTokens, 0);
  const dailyCost = dailyEvents.reduce((s, e) => s + e.estimatedCostCents, 0);
  const monthlyTokens = monthlyEvents.reduce((s, e) => s + e.inputTokens + e.outputTokens, 0);
  const monthlyCost = monthlyEvents.reduce((s, e) => s + e.estimatedCostCents, 0);

  const estTokens = estimatedInputTokens + estimatedOutputTokens;
  const estCost = estimateCost(model, estimatedInputTokens, estimatedOutputTokens);

  if (settings.dailyTokenLimit > 0 && dailyTokens + estTokens > settings.dailyTokenLimit) {
    throw new Error('DAILY_TOKEN_LIMIT_EXCEEDED: Daily token limit reached');
  }
  if (settings.monthlyTokenLimit > 0 && monthlyTokens + estTokens > settings.monthlyTokenLimit) {
    throw new Error('MONTHLY_TOKEN_LIMIT_EXCEEDED: Monthly token limit reached');
  }
  if (settings.dailyCostLimitCents > 0 && dailyCost + estCost > settings.dailyCostLimitCents) {
    throw new Error('DAILY_COST_LIMIT_EXCEEDED: Daily cost limit reached');
  }
  if (settings.monthlyCostLimitCents > 0 && monthlyCost + estCost > settings.monthlyCostLimitCents) {
    throw new Error('MONTHLY_COST_LIMIT_EXCEEDED: Monthly cost limit reached');
  }
}

// ── Cache ──────────────────────────────────────────────────────────────────

async function getCache(requestHash: string): Promise<string | null> {
  const db = getPrisma();
  const entry = await db.aiRequestCache.findUnique({ where: { requestHash } });
  if (!entry) return null;
  if (new Date() > entry.expiresAt) {
    await db.aiRequestCache.delete({ where: { requestHash } }).catch(() => {});
    return null;
  }
  await db.aiRequestCache.update({ where: { requestHash }, data: { hitCount: { increment: 1 } } }).catch(() => {});
  return entry.responseJson;
}

async function setCache(opts: {
  requestHash: string;
  provider: string;
  model: string;
  operation: string;
  responseJson: string;
  inputTokens: number;
  outputTokens: number;
  ttlHours?: number;
}): Promise<void> {
  const db = getPrisma();
  const expiresAt = new Date(Date.now() + (opts.ttlHours ?? 24) * 3_600_000);
  await db.aiRequestCache.upsert({
    where: { requestHash: opts.requestHash },
    create: { ...opts, expiresAt },
    update: { responseJson: opts.responseJson, expiresAt },
  }).catch((e: unknown) => { log.warn('[ai] Cache write failed:', e instanceof Error ? e.message : ''); });
}

// ── Main request function ──────────────────────────────────────────────────

export async function aiRequest<T extends ZodTypeAny>(
  opts: AiRequestOptions<T>,
  signal?: AbortSignal
): Promise<AiResponse<z.infer<T>>> {
  const db = getPrisma();
  const tier = opts.tier ?? 'balanced';
  const maxOutputTokens = opts.maxOutputTokens ?? 2048;
  const temperature = opts.temperature ?? 0.3;

  // Load provider config
  const provider = await db.aiProvider.findUniqueOrThrow({ where: { id: opts.providerId } });
  let routing: ProviderConfig['modelRouting'] = {};
  try { routing = JSON.parse(provider.modelRouting) as ProviderConfig['modelRouting']; } catch {
    // modelRouting may be empty string on a fresh provider row; default empty object is correct
  }
  const model = resolveModel(routing, tier, provider.providerType);
  const systemPrompt = opts.systemPrompt ?? 'You are a helpful academic assistant.';

  // Estimate tokens and check limits
  const estInput = estimateTokens(systemPrompt + opts.userPrompt);
  await checkLimits(estInput, maxOutputTokens, model);

  // Check cache
  const requestHash = hashRequest(opts.providerId, model, opts.operation, opts.userPrompt);
  const cached = await getCache(requestHash);

  if (cached) {
    log.info(`[ai] Cache hit for ${opts.operation}`);
    const data = opts.responseSchema ? opts.responseSchema.parse(JSON.parse(cached)) as z.infer<T> : JSON.parse(cached) as z.infer<T>;
    const inputTokens = estInput;
    const outputTokens = estimateTokens(cached);
    await db.aiUsageEvent.create({
      data: {
        provider: provider.providerType,
        model,
        operation: opts.operation,
        inputTokens,
        outputTokens,
        estimatedCostCents: 0,
        cacheHit: true,
        requestHash,
        lectureId: opts.lectureId,
        courseId: opts.courseId,
      },
    });
    return { data, inputTokens, outputTokens, estimatedCostCents: 0, cacheHit: true, model, provider: provider.providerType };
  }

  // Execute request
  const apiKey = SecretsService.getSecret(`provider.${opts.providerId}`) ?? '';

  let rawContent: string;
  let inputTokens: number;
  let outputTokens: number;

  const callOpts = { systemPrompt, userPrompt: opts.userPrompt, maxTokens: maxOutputTokens, temperature, signal };

  try {
    if (provider.providerType === 'openai' || provider.providerType === 'openai-compat') {
      const baseUrl = provider.baseUrl || 'https://api.openai.com/v1';
      const res = await callOpenAI({ apiKey, baseUrl, model, ...callOpts });
      rawContent = res.content; inputTokens = res.inputTokens; outputTokens = res.outputTokens;
    } else if (provider.providerType === 'azure') {
      const endpoint = provider.baseUrl ?? '';
      const deployment = routing.balanced ?? model;
      const res = await callAzure({ apiKey, endpoint, deployment, apiVersion: '2024-02-01', ...callOpts });
      rawContent = res.content; inputTokens = res.inputTokens; outputTokens = res.outputTokens;
    } else if (provider.providerType === 'gemini') {
      const res = await callGemini({ apiKey, model, ...callOpts });
      rawContent = res.content; inputTokens = res.inputTokens; outputTokens = res.outputTokens;
    } else if (provider.providerType === 'ollama' || provider.providerType === 'lmstudio') {
      const baseUrl = provider.baseUrl || (provider.providerType === 'ollama' ? 'http://localhost:11434/v1' : 'http://localhost:1234/v1');
      const res = await callOpenAI({ apiKey: 'ollama', baseUrl, model, ...callOpts });
      rawContent = res.content; inputTokens = res.inputTokens; outputTokens = res.outputTokens;
    } else {
      throw new Error(`Unknown provider type: ${provider.providerType}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Ensure auth headers are NOT in the message
    const safeMsg = msg.replace(/Bearer\s+\S+/gi, '******').replace(/api[-_]key[=:]\S+/gi, 'api-key=****');
    throw new Error(safeMsg);
  }

  // Validate structured output
  let data: z.infer<T>;
  if (opts.responseSchema) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = /```json\s*([\s\S]*?)\s*```/.exec(rawContent) ?? /(\{[\s\S]*\}|\[[\s\S]*\])/.exec(rawContent);
      const jsonStr = jsonMatch?.[1] ?? rawContent;
      const parsed = JSON.parse(jsonStr);
      data = opts.responseSchema.parse(parsed) as z.infer<T>;
    } catch {
      // One bounded repair attempt: ask the model to fix its output
      log.warn('[ai] Structured output validation failed, attempting repair');
      const repairPrompt = `Your previous response was not valid JSON matching the required schema. Please respond with ONLY valid JSON, no markdown, no explanation.\n\nRequired schema description: ${opts.responseSchema.description ?? 'JSON object'}\n\nYour previous response: ${rawContent.slice(0, 500)}`;

      let repairContent: string;
      try {
        if (provider.providerType === 'openai' || provider.providerType === 'openai-compat') {
          const baseUrl = provider.baseUrl || 'https://api.openai.com/v1';
          const r = await callOpenAI({ apiKey, baseUrl, model, systemPrompt, userPrompt: repairPrompt, maxTokens: maxOutputTokens, temperature: 0, signal });
          repairContent = r.content;
          inputTokens += r.inputTokens; outputTokens += r.outputTokens;
        } else if (provider.providerType === 'gemini') {
          const r = await callGemini({ apiKey, model, systemPrompt, userPrompt: repairPrompt, maxTokens: maxOutputTokens, temperature: 0, signal });
          repairContent = r.content; inputTokens += r.inputTokens; outputTokens += r.outputTokens;
        } else {
          throw new Error('Cannot repair: unsupported provider for repair');
        }
        const jsonMatch2 = /```json\s*([\s\S]*?)\s*```/.exec(repairContent) ?? /(\{[\s\S]*\}|\[[\s\S]*\])/.exec(repairContent);
        const jsonStr2 = jsonMatch2?.[1] ?? repairContent;
        data = opts.responseSchema.parse(JSON.parse(jsonStr2)) as z.infer<T>;
      } catch (repairErr) {
        throw new Error(`AI response failed schema validation after repair attempt: ${repairErr instanceof Error ? repairErr.message : String(repairErr)}`);
      }
    }
  } else {
    data = rawContent as z.infer<T>;
  }

  const estimatedCostCents = estimateCost(model, inputTokens, outputTokens);

  // Persist usage
  await db.aiUsageEvent.create({
    data: {
      provider: provider.providerType,
      model,
      operation: opts.operation,
      inputTokens,
      outputTokens,
      estimatedCostCents,
      cacheHit: false,
      requestHash,
      lectureId: opts.lectureId,
      courseId: opts.courseId,
    },
  }).catch((e: unknown) => { log.warn('[ai] Usage event write failed:', e instanceof Error ? e.message : ''); });

  // Cache successful response
  await setCache({
    requestHash,
    provider: provider.providerType,
    model,
    operation: opts.operation,
    responseJson: opts.responseSchema ? JSON.stringify(data) : rawContent,
    inputTokens,
    outputTokens,
  });

  return { data, inputTokens, outputTokens, estimatedCostCents, cacheHit: false, model, provider: provider.providerType };
}

// ── AI configured check ───────────────────────────────────────────────────

/**
 * Returns true when the given provider exists, is enabled, and has a secret
 * key stored in the OS keychain. All six AI-only IPC handlers call this
 * before invoking any learning function so that the app stays fully usable
 * without a configured AI provider.
 *
 * Pass `providerId = undefined` to check the current default provider.
 */
export async function isAiConfigured(providerId?: string): Promise<boolean> {
  const db = getPrisma();
  let resolvedId = providerId;
  log.info('[ai] isAiConfigured:start', { providerId });

  if (!resolvedId) {
    const settings = await SettingsService.get();
    resolvedId = settings.defaultAiProvider ?? undefined;
    log.info('[ai] isAiConfigured:resolvedDefault', { resolvedId });
  }

  if (!resolvedId) {
    // Try to find any enabled provider with a stored key
    const providers = await db.aiProvider.findMany({ where: { enabled: true } });
    const configured = providers.some((p) => SecretsService.hasSecret(`provider.${p.id}`));
    log.info('[ai] isAiConfigured:fallback', { providerCount: providers.length, configured });
    return configured;
  }

  const provider = await db.aiProvider.findUnique({ where: { id: resolvedId } });
  if (!provider || !provider.enabled) {
    log.warn('[ai] isAiConfigured:providerMissingOrDisabled', { resolvedId });
    return false;
  }
  const configured = SecretsService.hasSecret(`provider.${resolvedId}`);
  log.info('[ai] isAiConfigured:done', { resolvedId, configured });
  return configured;
}

// ── Provider connection test ───────────────────────────────────────────────

export async function testProviderConnection(providerId: string): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  const db = getPrisma();
  const provider = await db.aiProvider.findUnique({ where: { id: providerId } });
  if (!provider) return { ok: false, error: 'Provider not found' };

  const apiKey = SecretsService.getSecret(`provider.${providerId}`) ?? '';
  log.info('[ai] testProviderConnection:start', { providerId, providerType: provider.providerType, hasApiKey: Boolean(apiKey) });
  let routing: ProviderConfig['modelRouting'] = {};
  try { routing = JSON.parse(provider.modelRouting) as ProviderConfig['modelRouting']; } catch {
    // modelRouting may be empty string on a fresh provider row; default empty object is correct
  }
  const model = resolveModel(routing, 'economy', provider.providerType);

  const start = Date.now();
  try {
    const callOpts = { systemPrompt: 'You are a test.', userPrompt: 'Reply with the single word: OK', maxTokens: 5, temperature: 0 };
    let content = '';
    if (provider.providerType === 'openai' || provider.providerType === 'openai-compat') {
      const baseUrl = provider.baseUrl || 'https://api.openai.com/v1';
      const r = await callOpenAI({ apiKey, baseUrl, model, ...callOpts });
      content = r.content;
    } else if (provider.providerType === 'azure') {
      const deployment = routing.balanced ?? model;
      const r = await callAzure({ apiKey, endpoint: provider.baseUrl ?? '', deployment, apiVersion: '2024-02-01', ...callOpts });
      content = r.content;
    } else if (provider.providerType === 'gemini') {
      const r = await callGemini({ apiKey, model, ...callOpts });
      content = r.content;
    } else if (provider.providerType === 'ollama' || provider.providerType === 'lmstudio') {
      const baseUrl = provider.baseUrl || 'http://localhost:11434/v1';
      const r = await callOpenAI({ apiKey: 'ollama', baseUrl, model, ...callOpts });
      content = r.content;
    }
    const latencyMs = Date.now() - start;
    const ok = content.length > 0;
    await db.aiProvider.update({ where: { id: providerId }, data: { lastTestedAt: new Date(), lastTestOk: ok } });
    return { ok, latencyMs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const safeMsg = msg.replace(/Bearer\s+\S+/gi, '******').replace(/api[-_]key[=:]\S+/gi, 'api-key=****');
    await db.aiProvider.update({ where: { id: providerId }, data: { lastTestedAt: new Date(), lastTestOk: false } });
    return { ok: false, error: safeMsg.slice(0, 256) };
  }
}
