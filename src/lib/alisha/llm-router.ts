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
    // International endpoint (api.z.ai) — compatible with OpenAI API spec.
    // The Chinese endpoint (open.bigmodel.cn) returns a different catalog
    // and does not expose the free glm-*-flash models.
    baseUrl: 'https://api.z.ai/api/paas/v4', priority: 6,
    envNames: ['ZAI_API_KEY', 'GLM_API_KEY'],
    // Free $0 flash models confirmed working on api.z.ai. These IDs are not
    // returned by the /models catalog, so we declare them explicitly here.
    fixedModels: ['glm-4.7-flash', 'glm-4.5-flash', 'glm-4.6v-flash'],
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
  return !/(embedding|embed-|transcri|\btts\b|text-to-speech|audio|realtime|dall-e|gpt-image|imagen|moderation|whisper|rerank|ocr|asr|speech|video|computer-use|deep-research|robotics|\btts\b)/i.test(value);
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
    const preferred = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];
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
  // For non-anonymous providers that declare fixedModels (e.g. Z.ai flash models
  // which exist at the chat endpoint but are not returned by /models catalog),
  // merge them into every catalog response before verification.
  //
  // IMPORTANT: For transient failures (429, 5xx, network) we STILL include
  // fixedModels, because they are pre-verified in verified-models.json and
  // do not depend on the catalog response. The catalog is for runtime model
  // discovery, but fixedModels are a static declaration of models that are
  // known to work. Excluding them when the catalog is briefly unavailable
  // would block users from chatting even when the chat endpoint itself is
  // perfectly healthy.
  //
  // We only skip a key entirely when it is genuinely bad (401/403).
  const fixedRows = (provider.models ?? []).map((id) => ({ id, name: id }));
  checks.forEach((check, index) => {
    if (check.status === 401 || check.status === 403) return; // key is bad, skip
    const keyName = provider.apiKeyNames[index];
    const catalogModels = [...check.models];
    for (const fixed of fixedRows) {
      if (!catalogModels.some((m) => m.id === fixed.id)) catalogModels.push(fixed);
    }
    for (const model of catalogModels) {
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
  // 'partial' is the right status when the catalog was unreachable but
  // fixedModels gave us something to try — the chat route still accepts it.
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
  const eligibleKeys = modelKeyCache.get(providerId)?.get(modelId)
    ?? provider.apiKeyNames.filter((name) => isVerifiedForKey(providerId, name, modelId));
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

// Cooldown is keyed per-model, not per-provider. This lets a user switch
// to another model on the same provider when one model is rate-limited
// (e.g. glm-4.6v-flash overloaded but glm-4.5-flash still responds).
const cooldowns = new Map<string, number>();

function cooldownKey(providerId: string, modelId: string): string {
  return `${providerId}:${modelId}`;
}

function isOnCooldown(providerId: string, modelId: string): boolean {
  const expiry = cooldowns.get(cooldownKey(providerId, modelId));
  if (!expiry) return false;
  if (Date.now() > expiry) {
    cooldowns.delete(cooldownKey(providerId, modelId));
    return false;
  }
  return true;
}

function setCooldown(providerId: string, modelId: string, durationMs: number): void {
  // Clamp to [5s, 60s]: short enough that users can retry quickly,
  // long enough that we don't hammer an overloaded upstream.
  const clamped = Math.min(Math.max(durationMs, 5_000), 60_000);
  cooldowns.set(cooldownKey(providerId, modelId), Date.now() + clamped);
}

function retryAfterMs(value: string | null): number {
  const seconds = Number.parseInt(value || '', 10);
  // Default 10s (was 30s) — Z.ai's 1305 "service overloaded" error rarely
  // includes a Retry-After header, and 30s was blocking users too long.
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds * 1000, 5 * 60_000) : 10_000;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
  });
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
    const model = req.model || provider.models[0];
    if (!model) {
      diagnostics.push(`${provider.name}: no chat models`);
      continue;
    }
    // Per-model cooldown check — does not block sibling models on the same provider.
    if (isOnCooldown(provider.id, model)) {
      diagnostics.push(`${provider.name}/${model}: cooldown`);
      continue;
    }
    const keys: Array<string | undefined> = provider.apiKeys.length ? provider.apiKeys : [undefined];
    let retryMs = 10_000;
    let rateLimited = false;
    const modernOpenAIModel =
      (provider.id === 'openai' && /^(gpt-5|gpt-6|o1|o3|o4)(-|$)/i.test(model)) ||
      (provider.id === 'openrouter' && /^openai\/(gpt-5|gpt-6|o1|o3|o4)(-|$)/i.test(model));

    for (const apiKey of keys) {
      // Inner retry loop: on 429/5xx, wait briefly and retry once before giving up.
      // This absorbs transient "service overloaded" responses (e.g. Z.ai code 1305)
      // without surfacing an error to the user.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          if (apiKey) {
            // Google uses x-goog-api-key for its native REST catalog endpoint,
            // but its OpenAI-compatible Chat Completions endpoint requires Bearer.
            headers.Authorization = `Bearer ${apiKey}`;
          }
          if (provider.id === 'openrouter') {
            headers['HTTP-Referer'] = 'https://alisha-puce.vercel.app';
            headers['X-Title'] = 'Alisha';
          }
          const payload: Record<string, unknown> = {
            model,
            messages: req.messages,
            stream: false,
            [modernOpenAIModel ? 'max_completion_tokens' : 'max_tokens']:
              Math.min(Math.max(req.max_tokens ?? 700, 1), 1200),
          };
          if (!modernOpenAIModel) {
            // Z.ai accepts temperature in [0.0, 1.0] only; values > 1.0 are rejected.
            const temp = req.temperature ?? 0.7;
            payload.temperature = provider.id === 'zai' ? Math.min(Math.max(temp, 0), 1.0) : temp;
          }
          if (provider.id === 'zai') {
            // Disable long reasoning so the final answer lands directly in `content`
            // instead of being split into `reasoning_content`. Faster responses.
            payload.thinking = { type: 'disabled' };
          }
          const response = await fetch(`${provider.baseUrl}/chat/completions`, {
            method: 'POST', headers,
            body: JSON.stringify(payload),
            signal,
          });
          if (response.status === 429 || response.status >= 500) {
            if (response.status === 429) rateLimited = true;
            retryMs = retryAfterMs(response.headers.get('retry-after'));
            if (attempt === 0) {
              // Brief backoff then retry once on the same key.
              await sleep(1_500, signal);
              continue;
            }
            break; // out of attempt loop, fall through to "try next key" (continue below)
          }
          if (!response.ok) {
            diagnostics.push(`${provider.name}: HTTP ${response.status}`);
            if (response.status === 401 || response.status === 403) break;
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
          if (attempt === 0) {
            // Network blip — try once more before reporting.
            await sleep(500, signal);
            continue;
          }
          diagnostics.push(`${provider.name}: network error`);
        }
      }
    }
    if (provider.apiKeys.length > 0 && rateLimited) {
      // Cooldown is per-model so sibling models remain usable.
      setCooldown(provider.id, model, retryMs);
      diagnostics.push(`${provider.name}/${model}: rate limited`);
    }
  }
  throw new Error(`تعذر الاتصال بالمزود المحدد. ${diagnostics.join('; ')}`);
}
