import verifiedModelRegistry from './verified-models.json';

/**
 * Server-side LLM router. Credentials are read only from server environment
 * variables and are never returned in provider/model API responses.
 */

export interface LLMProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKeys: string[];
  apiKeyNames: string[];
  models: string[];
  priority: number;
  anonymous?: boolean;
}

export interface ChatRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  providerId?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface ProviderStatus {
  id: string;
  name: string;
  status: 'available' | 'valid' | 'partial' | 'invalid' | 'unavailable' | 'no-tested-models';
  keyCount: number;
  validKeyCount: number;
  verifiedKeyCount: number;
  models: Array<{ id: string; name: string }>;
}

interface ProviderDefinition {
  id: string;
  name: string;
  baseUrl: string;
  priority: number;
  envNames: string[];
  anonymous?: boolean;
  fixedModels?: string[];
}

const DEFINITIONS: ProviderDefinition[] = [
  {
    id: 'pollinations', name: 'Pollinations',
    baseUrl: 'https://text.pollinations.ai/openai', priority: 1,
    envNames: ['POLLINATIONS_API_KEY'], anonymous: true,
    fixedModels: ['openai-fast'],
  },
  {
    id: 'google', name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', priority: 2,
    envNames: ['GEMINI_API_KEY', 'GEMINI_API_KEY_2'],
  },
  {
    id: 'openai', name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1', priority: 3,
    envNames: ['OPENAI_API_KEY'],
  },
  {
    id: 'openrouter', name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1', priority: 4,
    envNames: ['OPENROUTER_API_KEY', 'OPENROUTER_API_KEY_2'],
  },
  {
    id: 'huggingface', name: 'Hugging Face Inference',
    baseUrl: 'https://router.huggingface.co/v1', priority: 5,
    envNames: ['HUGGINGFACE_API_KEY', 'HF_TOKEN'],
  },
  {
    id: 'zai', name: 'Z.ai / GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4', priority: 6,
    envNames: ['ZAI_API_KEY', 'GLM_API_KEY'],
  },
];

const MODEL_CACHE_MS = 5 * 60_000;
const modelCache = new Map<string, { expiresAt: number; result: ProviderStatus }>();
// Internal only: for each provider/model, retain the exact server-side keys
// whose authenticated catalog returned that model. Never include this in API output.
const modelKeyCache = new Map<string, Map<string, string[]>>();

const verifiedModels = verifiedModelRegistry as {
  modelsByKey: Record<string, Record<string, string[]>>;
  noKeyModels: Record<string, string[]>;
};

function keysFor(definition: ProviderDefinition): Array<{ name: string; value: string }> {
  const entries: Array<{ name: string; value: string }> = [];
  for (const name of definition.envNames) {
    const value = process.env[name]?.trim();
    if (!value) continue;
    entries.push({ name, value });
  }
  return entries;
}

function isVerifiedForKey(providerId: string, keyName: string, modelId: string): boolean {
  return verifiedModels.modelsByKey[providerId]?.[keyName]?.includes(modelId) ?? false;
}

/** Only configured providers are included, except the anonymous Pollinations tier. */
export function buildProviderList(modelsByProvider: Record<string, string[]> = {}): LLMProvider[] {
  return DEFINITIONS.flatMap((definition) => {
    const keyEntries = keysFor(definition);
    if (!definition.anonymous && keyEntries.length === 0) return [];
    return [{
      id: definition.id,
      name: definition.name,
      baseUrl: definition.baseUrl,
      apiKeys: keyEntries.map((entry) => entry.value),
      apiKeyNames: keyEntries.map((entry) => entry.name),
      models: modelsByProvider[definition.id] ?? definition.fixedModels ?? [],
      priority: definition.priority,
      anonymous: definition.anonymous,
    }];
  }).sort((a, b) => a.priority - b.priority);
}

function isChatModelId(id: string): boolean {
  const value = id.toLowerCase();
  return !/(embedding|embed-|transcri|\btts\b|text-to-speech|audio|realtime|dall-e|gpt-image|moderation|whisper|rerank|ocr|asr|speech|video|computer-use|deep-research|\btts\b)/i.test(value);
}

function unwrapModelRows(data: any): any[] {
  if (Array.isArray(data?.models)) return data.models;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function normalizeModelRows(rows: any[], providerId: string): Array<{ id: string; name: string }> {
  const normalized: Array<{ id: string; name: string }> = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    let id = typeof row.id === 'string' ? row.id : typeof row.name === 'string' ? row.name : '';
    id = id.replace(/^models\//, '').trim();
    if (!id || !isChatModelId(id)) continue;

    if (providerId === 'google') {
      const methods = row.supportedGenerationMethods;
      if (Array.isArray(methods) && !methods.includes('generateContent')) continue;
      const output = row.outputModalities ?? row.output_modalities;
      if (Array.isArray(output) && output.length > 0 && !output.some((mode: unknown) => String(mode).toUpperCase() === 'TEXT')) continue;
    }
    if (providerId === 'openrouter') {
      const modality = row.architecture?.modality;
      const output = row.architecture?.output_modalities;
      if (typeof modality === 'string' && modality.length > 0 && !/text.*->.*text/i.test(modality)) continue;
      if (Array.isArray(output) && output.length > 0 && !output.some((mode: unknown) => String(mode).toLowerCase() === 'text')) continue;
    }

    normalized.push({
      id,
      name: (typeof row.displayName === 'string' && row.displayName) || (typeof row.name === 'string' ? row.name.replace(/^models\//, '') : id),
    });
  }

  const unique = new Map<string, { id: string; name: string }>();
  for (const model of normalized) unique.set(model.id, model);
  const result = [...unique.values()];
  if (providerId === 'google') {
    const preferred = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];
    result.sort((a, b) => {
      const ai = preferred.indexOf(a.id);
      const bi = preferred.indexOf(b.id);
      if (ai >= 0 || bi >= 0) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      return a.name.localeCompare(b.name);
    });
  } else {
    result.sort((a, b) => a.name.localeCompare(b.name));
  }
  return result;
}

async function readModelCatalog(provider: LLMProvider, apiKey: string): Promise<{ status: number; models: Array<{ id: string; name: string }> }> {
  if (provider.id === 'pollinations') {
    return { status: 200, models: (provider.models.length ? provider.models : ['openai-fast']).map((id) => ({ id, name: id })) };
  }

  let url = `${provider.baseUrl}/models`;
  let headers: Record<string, string> = { Accept: 'application/json' };
  if (provider.id === 'google') {
    url = 'https://generativelanguage.googleapis.com/v1beta/models';
    headers['x-goog-api-key'] = apiKey;
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
    if (provider.id === 'openrouter') url = 'https://openrouter.ai/api/v1/models/user';
  }

  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(12_000),
      cache: 'no-store',
    });
    if (!response.ok) return { status: response.status, models: [] };
    const data = await response.json();
    const rows = provider.id === 'google' && Array.isArray(data?.models) ? data.models : unwrapModelRows(data);
    return { status: response.status, models: normalizeModelRows(rows, provider.id) };
  } catch {
    return { status: 0, models: [] };
  }
}

async function inspectProvider(provider: LLMProvider, force = false): Promise<ProviderStatus> {
  const cached = modelCache.get(provider.id);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.result;

  if (provider.anonymous && provider.apiKeys.length === 0) {
    const verifiedIds = new Set(verifiedModels.noKeyModels[provider.id] ?? []);
    const verified = (provider.models.length ? provider.models : ['openai-fast'])
      .filter((id) => verifiedIds.has(id))
      .map((id) => ({ id, name: id }));
    const result: ProviderStatus = {
      id: provider.id, name: provider.name, status: verified.length ? 'available' : 'no-tested-models',
      keyCount: 0, validKeyCount: 0, verifiedKeyCount: 0,
      models: verified,
    };
    modelCache.set(provider.id, { expiresAt: Date.now() + MODEL_CACHE_MS, result });
    return result;
  }

  const checks = await Promise.all(provider.apiKeys.map((key) => readModelCatalog(provider, key)));
  const valid = checks.filter((check) => check.status >= 200 && check.status < 300);
  const models = new Map<string, { id: string; name: string }>();
  const keysByModel = new Map<string, string[]>();
  checks.forEach((check, index) => {
    if (check.status < 200 || check.status >= 300) return;
    const keyName = provider.apiKeyNames[index];
    for (const model of check.models) {
      if (!isVerifiedForKey(provider.id, keyName, model.id)) continue;
      models.set(model.id, model);
      const keys = keysByModel.get(model.id) ?? [];
      keys.push(keyName);
      keysByModel.set(model.id, keys);
    }
  });
  modelKeyCache.set(provider.id, keysByModel);
  const mergedModels = [...models.values()].sort((a, b) => a.name.localeCompare(b.name));
  const allDenied = checks.length > 0 && checks.every((check) => check.status === 401 || check.status === 403);
  const verifiedKeyCount = new Set([...keysByModel.values()].flat()).size;
  const status: ProviderStatus['status'] = mergedModels.length === 0
    ? valid.length > 0 ? 'no-tested-models' : allDenied ? 'invalid' : 'unavailable'
    : valid.length === checks.length && verifiedKeyCount === provider.apiKeys.length ? 'valid' : 'partial';
  const result: ProviderStatus = {
    id: provider.id,
    name: provider.name,
    status,
    keyCount: provider.apiKeys.length,
    validKeyCount: valid.length,
    verifiedKeyCount,
    models: mergedModels,
  };
  modelCache.set(provider.id, { expiresAt: Date.now() + MODEL_CACHE_MS, result });
  return result;
}

/** Public-safe health/model inventory; never returns key values or upstream error bodies. */
export async function listProviderStatuses(options: { providerId?: string; force?: boolean } = {}): Promise<ProviderStatus[]> {
  const providers = buildProviderList();
  const selected = options.providerId ? providers.filter((provider) => provider.id === options.providerId) : providers;
  return Promise.all(selected.map((provider) => inspectProvider(provider, options.force)));
}

/** Find a provider with only its own configured keys for the selected model. */
export async function getSelectedProvider(providerId: string, modelId: string): Promise<LLMProvider | null> {
  const status = (await listProviderStatuses({ providerId }))[0];
  if (!status || !status.models.some((model) => model.id === modelId)) return null;
  const provider = buildProviderList({ [providerId]: status.models.map((model) => model.id) })
    .find((item) => item.id === providerId);
  if (!provider) return null;
  if (provider.anonymous) return provider;
  const eligibleKeys = modelKeyCache.get(providerId)?.get(modelId);
  if (!eligibleKeys?.length) return null;
  const eligibleIndexes = provider.apiKeyNames
    .map((name, index) => eligibleKeys.includes(name) ? index : -1)
    .filter((index) => index >= 0);
  return {
    ...provider,
    apiKeys: eligibleIndexes.map((index) => provider.apiKeys[index]),
    apiKeyNames: eligibleIndexes.map((index) => provider.apiKeyNames[index]),
  };
}

const cooldowns = new Map<string, number>();

function isOnCooldown(providerId: string): boolean {
  const expiry = cooldowns.get(providerId);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    cooldowns.delete(providerId);
    return false;
  }
  return true;
}

function setCooldown(providerId: string, durationMs: number): void {
  cooldowns.set(providerId, Date.now() + Math.max(durationMs, 5_000));
}

function retryAfterMs(value: string | null): number {
  const seconds = Number.parseInt(value || '', 10);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 5 * 60_000) : 30_000;
}

/** Routes a chat request through the selected provider, trying its configured key pool. */
export async function routeChat(
  req: ChatRequest,
  providers: LLMProvider[],
  signal?: AbortSignal,
): Promise<{ text: string; model: string; provider: string }> {
  const ordered = req.providerId
    ? providers.filter((provider) => provider.id === req.providerId)
    : [...providers].sort((a, b) => a.priority - b.priority);
  if (ordered.length === 0) throw new Error('المزود المحدد غير مهيأ على الخادم.');

  const diagnostics: string[] = [];
  for (const provider of ordered) {
    if (isOnCooldown(provider.id)) {
      diagnostics.push(`${provider.name}: cooldown`);
      continue;
    }
    const model = req.model || provider.models[0];
    if (!model) {
      diagnostics.push(`${provider.name}: no chat models`);
      continue;
    }
    const keys: Array<string | undefined> = provider.apiKeys.length ? provider.apiKeys : [undefined];
    let retryMs = 30_000;
    let rateLimited = false;
    const modernOpenAIModel = provider.id === 'openai' && /^(gpt-5|o1|o3)(-|$)/i.test(model);

    for (const apiKey of keys) {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey) {
          // Google uses x-goog-api-key for its native REST catalog endpoint,
          // but its OpenAI-compatible Chat Completions endpoint requires Bearer.
          headers.Authorization = `Bearer ${apiKey}`;
        }
        const payload: Record<string, unknown> = {
          model,
          messages: req.messages,
          stream: false,
          [modernOpenAIModel ? 'max_completion_tokens' : 'max_tokens']:
            Math.min(Math.max(req.max_tokens ?? 700, 1), 1200),
        };
        if (!modernOpenAIModel) payload.temperature = req.temperature ?? 0.7;
        const response = await fetch(`${provider.baseUrl}/chat/completions`, {
          method: 'POST', headers,
          body: JSON.stringify(payload),
          signal,
        });
        if (response.status === 429 || response.status >= 500) {
          if (response.status === 429) rateLimited = true;
          retryMs = retryAfterMs(response.headers.get('retry-after'));
          continue;
        }
        if (!response.ok) {
          diagnostics.push(`${provider.name}: HTTP ${response.status}`);
          if (response.status === 401 || response.status === 403) continue;
          break;
        }
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content;
        if (typeof text !== 'string' || !text.trim()) {
          diagnostics.push(`${provider.name}: empty response`);
          break;
        }
        return { text: text.trim(), model, provider: provider.name };
      } catch (error: any) {
        if (error?.name === 'AbortError') throw error;
        diagnostics.push(`${provider.name}: network error`);
      }
    }
    if (provider.apiKeys.length > 0 && rateLimited) {
      setCooldown(provider.id, retryMs);
      diagnostics.push(`${provider.name}: rate limited`);
    }
  }
  throw new Error(`تعذر الاتصال بالمزود المحدد. ${diagnostics.join('; ')}`);
}
