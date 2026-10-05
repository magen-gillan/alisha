'use client';

/**
 * Pollinations.ai client wrapper.
 *
 * Why a separate client?
 * - Pollinations exposes an OpenAI-compatible endpoint at
 *   https://text.pollinations.ai/openai/chat/completions
 * - We proxy through /api/pollinations so:
 *   • The user-supplied API key is sent over HTTPS, not in client JS
 *   • We can attach the baked-in server key (POLLINATIONS_API_KEY) when the
 *     user does not provide one (anonymous tier also works)
 *   • We can swap the request shape / handle retries centrally
 *
 * NOTE: Pollinations does NOT provide TTS. The browser's Web Speech API is
 * used for TTS regardless of provider.
 */

import type {
  ChatRequest,
  ChatResponse,
  GeminiModel,
  ResponseLanguage,
} from './types';
import { detectLanguage, systemInstructionFor } from './language';

const API_BASE = '/api/pollinations/';

const STORAGE_KEY = 'alisha-pollinations-api-key';

export function getPollinationsApiKey(): string {
  if (typeof window !== 'undefined') {
    const userKey = localStorage.getItem(STORAGE_KEY) || '';
    if (userKey.trim()) return userKey.trim();
  }
  return '';
}

export function setPollinationsApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  if (key.trim()) {
    localStorage.setItem(STORAGE_KEY, key.trim());
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function hasPollinationsApiKey(): boolean {
  return getPollinationsApiKey().length > 0;
}

/**
 * Whether requests will use the server-side baked-in key (if configured)
 * instead of a user-provided one. UI indicator only.
 */
export function isUsingBakedPollinationsKey(): boolean {
  if (typeof window === 'undefined') return true;
  const userKey = localStorage.getItem(STORAGE_KEY) || '';
  return !userKey.trim();
}

/**
 * GET — list models available on Pollinations.
 *
 * Anonymous tier returns a single model (openai-fast). With a registered
 * API key (sk_...) more models become available.
 *
 * NOTE: The Next.js App Router maps /api/pollinations to route.ts which
 * exports both GET and POST handlers. We hit the same URL for both methods
 * (no /models or /chat suffix) so the routing works correctly.
 */
export async function listPollinationsModels(apiKey?: string): Promise<GeminiModel[]> {
  const key = apiKey || getPollinationsApiKey();
  const headers: Record<string, string> = {};
  if (key) headers['x-client-key'] = key;

  const resp = await fetch(API_BASE, { headers });
  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(data?.error?.message || `Failed to list Pollinations models (HTTP ${resp.status}).`);
  }

  const items: any[] = Array.isArray(data?.models) ? data.models : (Array.isArray(data?.data) ? data.data : []);

  const models: GeminiModel[] = items.map((m: any) => {
    const name = String(m?.name || m?.id || '').trim();
    const inputs = Array.isArray(m?.input_modalities) ? m.input_modalities : [];
    const outputs = Array.isArray(m?.output_modalities) ? m.output_modalities : [];
    return {
      name,
      displayName: m?.description || name,
      description: m?.description,
      supportedMethods: inputs.includes('text') ? ['generateContent'] : [],
      inputModalities: inputs,
      outputModalities: outputs,
      tools: Boolean(m?.tools),
    };
  });

  // Keep only text-input → text-output models that support generateContent.
  const usable = models.filter((m) => {
    if (!m.name) return false;
    if (!m.supportedMethods?.includes('generateContent')) return false;
    if (!m.inputModalities?.includes('text')) return false;
    if (!m.outputModalities?.includes('text')) return false;
    return true;
  });

  // Sort: prefer reasoning models, then alphabetical.
  usable.sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    if (aName === 'openai-fast') return -1;
    if (bName === 'openai-fast') return 1;
    return aName.localeCompare(bName);
  });

  return usable;
}

/**
 * POST /chat/completions — generate a response, language-forced.
 *
 * Mirrors chatWithGemini's signature so VoiceChatButton / TextChatButton
 * can treat both providers identically.
 */
export async function chatWithPollinations(req: ChatRequest, apiKey?: string): Promise<ChatResponse> {
  const key = apiKey || getPollinationsApiKey();
  if (!req.userInput?.trim()) {
    throw new Error('userInput is required.');
  }
  // Client-side length guard.
  if (req.userInput.length > 8000) {
    throw new Error('الرسالة طويلة جداً. الحد الأقصى 8000 حرف.');
  }

  const responseLanguage: ResponseLanguage = ['en', 'ar', 'ja'].includes(
    req.responseLanguage as ResponseLanguage
  )
    ? req.responseLanguage
    : 'en';

  const detected = detectLanguage(req.userInput);

  // Pollinations model fallback chain. openai-fast is always available
  // (anonymous tier), so even if the user has an invalid model selected we
  // retry once.
  const requestedModel = req.model || 'openai-fast';

  // Build OpenAI-style messages
  const permMem = (req.permanentMemory || '').trim();
  const langInstr = systemInstructionFor(responseLanguage);
  const systemText = permMem ? `${permMem}\n\n---\n\n${langInstr}` : langInstr;

  const messages: any[] = [];
  if (systemText) {
    messages.push({ role: 'system', content: systemText });
  }
  for (const m of req.history ?? []) {
    messages.push({
      role: m.role === 'model' ? 'assistant' : 'user',
      content: m.text,
    });
  }
  messages.push({ role: 'user', content: req.userInput });

  const body: Record<string, unknown> = {
    model: requestedModel,
    messages,
    temperature: 0.8,
    top_p: 0.95,
    max_tokens: 1024,
    stream: false,
  };
  if (key) body.apiKey = key;

  const resp = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: req.signal,
  });
  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(data?.error?.message || `Pollinations request failed (HTTP ${resp.status}).`);
  }

  // OpenAI-compatible response: data.choices[0].message.content
  const text: string =
    data?.choices?.[0]?.message?.content?.toString().trim() ||
    data?.choices?.[0]?.delta?.content?.toString().trim() ||
    '';

  if (!text) {
    throw new Error('Empty response from Pollinations.');
  }

  return {
    text,
    detectedLanguage: detected,
    responseLanguage,
    model: requestedModel,
  };
}
