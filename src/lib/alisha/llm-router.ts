/**
 * Unified LLM Router — inspired by FreeLLMAPI.
 *
 * Aggregates multiple OpenAI-compatible providers behind a single endpoint.
 * The router:
 * 1. Tries providers in priority order
 * 2. Falls back to the next provider on rate-limit (429) or error (5xx)
 * 3. Tracks per-key cooldowns in memory
 * 4. Supports both user-supplied keys and anonymous (keyless) providers
 *
 * Each provider entry has:
 *   - id: unique identifier
 *   - name: display name
 *   - baseUrl: OpenAI-compatible API base URL
 *   - apiKey: user's API key (or empty for anonymous)
 *   - models: list of available model IDs
 *   - priority: lower = tried first
 *   - anonymous: true if no key needed
 */

export interface LLMProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  models: string[];
  priority: number;
  anonymous?: boolean;
  enabled: boolean;
}

export interface ChatRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  text: string;
  model: string;
  provider: string;
}

// In-memory cooldown tracking: providerId → expiry timestamp
const cooldowns = new Map<string, number>();

/** Check if a provider is currently on cooldown */
function isOnCooldown(providerId: string): boolean {
  const expiry = cooldowns.get(providerId);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    cooldowns.delete(providerId);
    return false;
  }
  return true;
}

/** Set a cooldown on a provider (e.g. after a 429) */
function setCooldown(providerId: string, durationMs: number): void {
  cooldowns.set(providerId, Date.now() + durationMs);
}

/** Parse Retry-After header (seconds or HTTP date) */
function parseRetryAfterMs(value: string | null): number {
  if (!value) return 60_000; // default 60s
  const seconds = parseInt(value, 10);
  if (!isNaN(seconds)) return seconds * 1000;
  return 60_000;
}

/**
 * The built-in free providers catalog.
 * These work WITHOUT any API key (anonymous tier).
 * User-added keys override the anonymous behavior.
 */
export const FREE_PROVIDERS: Omit<LLMProvider, 'apiKey' | 'enabled'>[] = [
  {
    id: 'pollinations',
    name: 'Pollinations',
    baseUrl: 'https://text.pollinations.ai/openai',
    models: ['openai-fast'],
    priority: 1,
    anonymous: true,
  },
  {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    priority: 2,
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    models: ['llama-3.3-70b', 'llama-3.1-8b'],
    priority: 3,
  },
  {
    id: 'google',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: ['gemini-flash-latest', 'gemini-flash-lite-latest'],
    priority: 4,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (free)',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['meta-llama/llama-3.3-70b-instruct:free', 'google/gemini-flash-1.5:free'],
    priority: 5,
  },
  {
    id: 'mistral',
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    models: ['mistral-small-latest', 'mistral-tiny'],
    priority: 6,
  },
  {
    id: 'cohere',
    name: 'Cohere',
    baseUrl: 'https://api.cohere.ai/v1',
    models: ['command-r-plus', 'command-r'],
    priority: 7,
  },
  {
    id: 'samba',
    name: 'SambaNova',
    baseUrl: 'https://api.sambanova.ai/v1',
    models: ['Meta-Llama-3.1-70B-Instruct'],
    priority: 8,
  },
  {
    id: 'nvidia',
    name: 'NVIDIA',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    models: ['meta/llama-3.3-70b-instruct'],
    priority: 9,
  },
  {
    id: 'zhipu',
    name: 'Z.ai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-flash', 'glm-4-flashx'],
    priority: 10,
  },
  {
    id: 'custom',
    name: 'Custom Endpoint',
    baseUrl: '',
    models: [],
    priority: 99,
  },
];

/**
 * Build the active provider list from:
 * 1. User-supplied keys (from localStorage)
 * 2. Anonymous free providers (Pollinations)
 * 3. Server-side baked keys (Gemini from Vercel env)
 */
export function buildProviderList(userKeys: Record<string, string> = {}): LLMProvider[] {
  const providers: LLMProvider[] = [];

  for (const p of FREE_PROVIDERS) {
    const userKey = userKeys[p.id];
    const serverKey = p.id === 'google' ? (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '') : '';

    // Include if: anonymous (Pollinations), or has user key, or has server key
    const hasKey = Boolean(userKey || serverKey);
    if (p.anonymous || hasKey) {
      providers.push({
        ...p,
        apiKey: userKey || serverKey || undefined,
        enabled: true,
      });
    }
  }

  // Sort by priority
  providers.sort((a, b) => a.priority - b.priority);
  return providers;
}

/**
 * Route a chat request through available providers.
 * Tries each provider in priority order, falls back on error.
 */
export async function routeChat(
  req: ChatRequest,
  providers: LLMProvider[],
  signal?: AbortSignal,
): Promise<ChatResponse> {
  if (providers.length === 0) {
    throw new Error('No providers configured. Add an API key or use the free tier.');
  }

  let lastError: Error | null = null;
  const diagnostics: string[] = [];

  for (const provider of providers) {
    if (!provider.enabled) continue;
    if (isOnCooldown(provider.id)) {
      diagnostics.push(`${provider.name}: on cooldown`);
      continue;
    }

    try {
      // Pick a model: use the requested model if this provider has it,
      // otherwise use the provider's first model.
      let model = req.model || provider.models[0];
      if (!provider.models.includes(model)) {
        model = provider.models[0];
      }

      const url = `${provider.baseUrl}/chat/completions`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Auth varies by provider
      if (provider.apiKey) {
        if (provider.id === 'google') {
          // Gemini uses API key in URL or x-goog-api-key header
          headers['x-goog-api-key'] = provider.apiKey;
        } else if (provider.id === 'cohere') {
          headers['Authorization'] = `Bearer ${provider.apiKey}`;
        } else {
          headers['Authorization'] = `Bearer ${provider.apiKey}`;
        }
      }

      const body = {
        model,
        messages: req.messages,
        temperature: req.temperature ?? 0.8,
        max_tokens: req.max_tokens ?? 1024,
        stream: false,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      });

      if (response.status === 429 || response.status >= 500) {
        const retryAfter = parseRetryAfterMs(response.headers.get('retry-after'));
        setCooldown(provider.id, retryAfter);
        diagnostics.push(`${provider.name}: HTTP ${response.status} (cooldown ${Math.round(retryAfter / 1000)}s)`);
        lastError = new Error(`${provider.name} returned ${response.status}`);
        continue;
      }

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        diagnostics.push(`${provider.name}: HTTP ${response.status} - ${errBody.slice(0, 100)}`);
        lastError = new Error(`${provider.name}: ${response.status}`);
        continue;
      }

      const data = await response.json();

      // OpenAI-compatible response format
      const text = data?.choices?.[0]?.message?.content || '';
      if (!text) {
        diagnostics.push(`${provider.name}: empty response`);
        lastError = new Error(`${provider.name}: empty response`);
        continue;
      }

      return {
        text: text.trim(),
        model,
        provider: provider.name,
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      diagnostics.push(`${provider.name}: ${err?.message || 'unknown error'}`);
      lastError = err;
    }
  }

  // All providers exhausted
  throw new Error(
    `All providers exhausted. ${diagnostics.join('; ')}. ` +
    `Add more API keys or wait for rate limits to reset.`
  );
}

/**
 * List all available models across all configured providers.
 */
export function listAvailableModels(providers: LLMProvider[]): Array<{ id: string; provider: string; name: string }> {
  const models: Array<{ id: string; provider: string; name: string }> = [];
  for (const p of providers) {
    if (!p.enabled) continue;
    for (const m of p.models) {
      models.push({ id: m, provider: p.name, name: m });
    }
  }
  return models;
}

/**
 * Get cooldown status for all providers (for UI display).
 */
export function getProviderStatus(providers: LLMProvider[]): Array<{ id: string; name: string; onCooldown: boolean; resetIn?: number }> {
  return providers.map(p => {
    const expiry = cooldowns.get(p.id);
    if (!expiry || Date.now() > expiry) {
      return { id: p.id, name: p.name, onCooldown: false };
    }
    return {
      id: p.id,
      name: p.name,
      onCooldown: true,
      resetIn: Math.ceil((expiry - Date.now()) / 1000),
    };
  });
}
