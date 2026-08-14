'use client';

/**
 * Client-side Gemini wrapper.
 *
 * For static hosting (GitHub Pages), there is no server runtime, so we
 * call the Gemini REST API directly from the browser.
 *
 * API key resolution: an optional user key is sent over HTTPS to the private
 * Vercel route; the normal deployment key is read only from server environment.
 */

import type {
  ChatRequest,
  ChatResponse,
  GeminiModel,
  ResponseLanguage,
} from './types';
import { detectLanguage, systemInstructionFor } from './language';

const API_BASE = '/api/gemini';

export function getApiKey(): string {
  // 1. User-set key (overrides the encrypted Vercel server key)
  if (typeof window !== 'undefined') {
    const userKey = localStorage.getItem('alisha-gemini-api-key') || '';
    if (userKey.trim()) return userKey.trim();
  }
  return '';
}

export function setApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  if (key.trim()) {
    localStorage.setItem('alisha-gemini-api-key', key.trim());
  } else {
    localStorage.removeItem('alisha-gemini-api-key');
  }
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}

/**
 * UI-only indicator: an empty local key means requests use the encrypted
 * GEMINI_API_KEY configured on Vercel. The server value is never returned.
 */
export function isUsingBakedKey(): boolean {
  if (typeof window === 'undefined') return true;
  const userKey = localStorage.getItem('alisha-gemini-api-key') || '';
  return !userKey.trim();
}

/**
 * Models that are KNOWN to be deprecated for new Gemini API keys (created
 * after Google's migration deadline in late 2025 / early 2026).
 *
 * These models all return HTTP 404 with messages like:
 *   "This model models/gemini-2.5-flash is no longer available to new users."
 *   "models/gemini-1.5-flash is not found for API version v1beta"
 *
 * We block them from the picker so users never accidentally select one.
 */
const DEPRECATED_MODELS = new Set<string>([
  // gemini-2.x family — all deprecated for new users
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro-preview',
  'gemini-2.5-flash-preview',
  'gemini-2.0-flash',
  'gemini-2.0-pro',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-exp',
  'gemini-2.0-pro-exp',
  // gemini-1.5 family — removed from v1beta entirely
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro-vision',
  // Original gemini-pro — removed
  'gemini-pro',
  'gemini-pro-vision',
]);

/** GET /v1beta/models — list models the given key can actually use. */
export async function listGeminiModels(apiKey?: string): Promise<GeminiModel[]> {
  const key = apiKey || getApiKey();

  const resp = await fetch(API_BASE, key ? { headers: { 'x-client-key': key } } : undefined);
  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(data?.error?.message || `Failed to list models (HTTP ${resp.status}).`);
  }

  const all: GeminiModel[] = (data?.models ?? []).map((m: any) => ({
    name: (m.name || '').replace(/^models\//, ''),
    displayName: m.displayName || (m.name || '').replace(/^models\//, ''),
    description: m.description,
    supportedMethods: m.supportedGenerationMethods || [],
  }));

  // Filter:
  //  - Must start with "gemini-"
  //  - Must support generateContent
  //  - Must NOT be in the deprecated list
  //  - Must NOT be a preview/experimental variant (we don't want users picking
  //    unstable models)
  const usable = all.filter((m) => {
    if (!m.name.startsWith('gemini-')) return false;
    if (!Array.isArray(m.supportedMethods) || !m.supportedMethods.includes('generateContent')) {
      return false;
    }
    if (DEPRECATED_MODELS.has(m.name)) return false;
    // The picker is for text chat only: exclude image, preview, and experimental models.
    if (/(image|preview|exp|experimental|vision)/i.test(m.name)) return false;
    // Keep only production aliases returned for this exact API key. This avoids
    // showing models that are listed globally but are not stable for this app.
    if (!m.name.endsWith('-latest')) return false;
    return true;
  });

  // Sort: prefer "latest" aliases first (these are the only reliable models
  // for new users), then by name alphabetically.
  const preferredOrder = (n: string): number => {
    if (n === 'gemini-flash-latest') return 0;
    if (n === 'gemini-pro-latest') return 1;
    return 2;
  };
  usable.sort((a, b) => {
    const pa = preferredOrder(a.name);
    const pb = preferredOrder(b.name);
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });

  return usable;
}

/** POST /v1beta/models/{model}:generateContent — generate a response, language-forced. */
export async function chatWithGemini(req: ChatRequest, apiKey?: string): Promise<ChatResponse> {
  const key = apiKey || getApiKey();
  if (!req.userInput?.trim()) {
    throw new Error('userInput is required.');
  }

  const responseLanguage: ResponseLanguage = ['en', 'ar', 'ja'].includes(
    req.responseLanguage as ResponseLanguage
  )
    ? req.responseLanguage
    : 'en';

  const detected = detectLanguage(req.userInput);

  // Auto-migrate deprecated model selection to gemini-flash-latest.
  // Even if a user has a stale localStorage value, we never send a deprecated
  // model to the API.
  let modelId = req.model || 'gemini-flash-latest';
  if (DEPRECATED_MODELS.has(modelId)) {
    console.warn(
      `[gemini-client] Selected model "${modelId}" is deprecated; falling back to gemini-flash-latest.`
    );
    modelId = 'gemini-flash-latest';
  }

  // Build contents array with history + current user message
  const contents: any[] = (req.history ?? []).map((m) => ({
    role: m.role === 'model' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }));
  contents.push({
    role: 'user',
    parts: [{ text: req.userInput }],
  });

  // System instruction: permanent memory + language-forcing instruction
  const permMem = (req.permanentMemory || '').trim();
  const langInstr = systemInstructionFor(responseLanguage);
  const systemText = permMem
    ? `${permMem}\n\n---\n\n${langInstr}`
    : langInstr;

  const body = {
    contents,
    systemInstruction: {
      parts: [{ text: systemText }],
    },
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      // Leave enough output budget so the model cannot consume it before text appears.
      maxOutputTokens: 1024,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
  };

  const resp = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, model: modelId, ...(key ? { apiKey: key } : {}) }),
    signal: req.signal,
  });
  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(data?.error?.message || `Gemini request failed (HTTP ${resp.status}).`);
  }

  // Extract text from the first candidate
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text || '')
      .join('')
      .trim() || '';

  if (!text) {
    const blockReason = data?.promptFeedback?.blockReason;
    throw new Error(
      blockReason
        ? `Response blocked: ${blockReason}`
        : 'Empty response from Gemini.'
    );
  }

  return {
    text,
    detectedLanguage: detected,
    responseLanguage,
    model: modelId,
  };
}

export { DEPRECATED_MODELS };
