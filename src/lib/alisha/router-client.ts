'use client';

/**
 * Unified LLM client — replaces gemini-client and pollinations-client.
 *
 * Uses the /api/chat/ endpoint which routes through the LLM router.
 * The router automatically tries multiple providers with failover.
 *
 * Provider keys are stored in localStorage under 'alisha-provider-keys'.
 * Format: { groq: "gsk_...", google: "AIza...", openrouter: "sk-or-..." }
 */

import type { ChatRequest, ChatResponse, ResponseLanguage } from './types';
import { detectLanguage, systemInstructionFor } from './language';

const API_BASE = '/api/chat/';
const STORAGE_KEY = 'alisha-provider-keys';

/** Get all provider keys from localStorage */
export function getProviderKeys(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Save provider keys to localStorage */
export function setProviderKeys(keys: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

/** Check if any provider key is set */
export function hasAnyKey(): boolean {
  const keys = getProviderKeys();
  return Object.values(keys).some(k => k && k.trim());
}

/**
 * Chat with the unified LLM router.
 * Works exactly like chatWithGemini / chatWithPollinations but routes
 * through all available providers automatically.
 */
export async function chatWithRouter(req: ChatRequest): Promise<ChatResponse> {
  if (!req.userInput?.trim()) {
    throw new Error('userInput is required.');
  }
  if (req.userInput.length > 8000) {
    throw new Error('الرسالة طويلة جداً. الحد الأقصى 8000 حرف.');
  }

  const responseLanguage: ResponseLanguage = ['en', 'ar', 'ja'].includes(
    req.responseLanguage as ResponseLanguage
  )
    ? req.responseLanguage
    : 'en';

  const detected = detectLanguage(req.userInput);

  // Build OpenAI-compatible messages
  const permMem = (req.permanentMemory || '').trim();
  const langInstr = systemInstructionFor(responseLanguage);
  const systemText = permMem ? `${permMem}\n\n---\n\n${langInstr}` : langInstr;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
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

  // Get provider keys from localStorage
  const providerKeys = getProviderKeys();

  const body = {
    messages,
    model: req.model,
    temperature: 0.8,
    max_tokens: 1024,
    providerKeys,
  };

  const resp = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: req.signal,
  });

  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(data?.error?.message || `Chat failed (HTTP ${resp.status}).`);
  }

  const text: string = data?.choices?.[0]?.message?.content?.toString().trim() || '';

  if (!text) {
    throw new Error('Empty response from LLM router.');
  }

  return {
    text,
    detectedLanguage: detected,
    responseLanguage,
    model: data?.model || 'unknown',
  };
}

/**
 * List available models from the router.
 */
export async function listRouterModels(): Promise<Array<{ id: string; provider: string; name: string }>> {
  const providerKeys = getProviderKeys();
  const headers: Record<string, string> = {};
  if (Object.keys(providerKeys).length > 0) {
    headers['x-provider-keys'] = JSON.stringify(providerKeys);
  }

  const resp = await fetch(API_BASE, { headers });
  if (!resp.ok) return [];

  const data = await resp.json();
  return data?.models || data?.data || [];
}
