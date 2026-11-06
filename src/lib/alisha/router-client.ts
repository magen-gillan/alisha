'use client';

/** Client wrapper for the server-side provider router. Secret keys never enter this module. */

import type { ChatRequest, ChatResponse, ResponseLanguage } from './types';
import { detectLanguage, systemInstructionFor } from './language';

const API_BASE = '/api/chat/';
const PROVIDERS_API = '/api/providers';

export interface RouterModel {
  id: string;
  name: string;
}

export interface RouterProviderStatus {
  id: string;
  name: string;
  status: 'available' | 'valid' | 'partial' | 'invalid' | 'unavailable';
  keyCount: number;
  validKeyCount: number;
  models: RouterModel[];
}

/** Remove the former standalone localStorage copy of provider secrets. */
export function clearLegacyProviderKeys(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem('alisha-provider-keys');
  } catch {
    // Storage may be disabled; the application no longer reads or sends these values.
  }
}

export async function listRouterProviders(options: { providerId?: string; force?: boolean } = {}): Promise<RouterProviderStatus[]> {
  clearLegacyProviderKeys();
  const query = new URLSearchParams();
  if (options.providerId) query.set('provider', options.providerId);
  if (options.force) query.set('refresh', '1');
  const suffix = query.size ? `?${query.toString()}` : '';
  const response = await fetch(`${PROVIDERS_API}${suffix}`, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Provider check failed (HTTP ${response.status}).`);
  return Array.isArray(data?.providers) ? data.providers : [];
}

export async function chatWithRouter(req: ChatRequest): Promise<ChatResponse> {
  clearLegacyProviderKeys();
  if (!req.userInput?.trim()) throw new Error('userInput is required.');
  if (req.userInput.length > 8000) throw new Error('الرسالة طويلة جداً. الحد الأقصى 8000 حرف.');

  const responseLanguage: ResponseLanguage = ['en', 'ar', 'ja'].includes(req.responseLanguage as ResponseLanguage)
    ? req.responseLanguage
    : 'en';
  const detected = detectLanguage(req.userInput);
  const permanentMemory = (req.permanentMemory || '').trim();
  const languageInstruction = systemInstructionFor(responseLanguage);
  const systemText = permanentMemory ? `${permanentMemory}\n\n---\n\n${languageInstruction}` : languageInstruction;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (systemText) messages.push({ role: 'system', content: systemText });
  for (const message of req.history ?? []) {
    messages.push({ role: message.role === 'model' ? 'assistant' : 'user', content: message.text });
  }
  messages.push({ role: 'user', content: req.userInput });

  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      providerId: req.providerId,
      model: req.model,
      temperature: 0.7,
      max_tokens: 700,
    }),
    signal: req.signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Chat failed (HTTP ${response.status}).`);

  const text = data?.choices?.[0]?.message?.content?.toString().trim() || '';
  if (!text) throw new Error('Empty response from LLM router.');
  return {
    text,
    detectedLanguage: detected,
    responseLanguage,
    model: data?.model || 'unknown',
  };
}
