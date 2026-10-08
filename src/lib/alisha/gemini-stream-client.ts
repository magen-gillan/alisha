'use client';

/**
 * Streaming chat client for Gemini.
 *
 * Connects to the /api/gemini/stream/ SSE endpoint and yields text chunks
 * as they arrive from Gemini, enabling real-time text display.
 *
 * Inspired by Prometheus-avatar's streaming approach — the user sees the
 * first word within ~300ms instead of waiting for the full response.
 *
 * Usage:
 *   for await (const chunk of chatWithGeminiStream(req, apiKey, keyChoice)) {
 *     // chunk.text is the incremental text
 *     // chunk.done is true when the stream is complete
 *   }
 */

import type {
  ChatRequest,
  ChatResponse,
  ResponseLanguage,
  GeminiKeyChoice,
} from './types';
import { detectLanguage, systemInstructionFor } from './language';

const STREAM_API = '/api/gemini/stream/';

export interface StreamChunk {
  /** Incremental text received in this chunk */
  text: string;
  /** True when the stream is complete */
  done: boolean;
}

/**
 * Stream a chat response from Gemini via SSE.
 * Yields chunks as they arrive.
 */
export async function* chatWithGeminiStream(
  req: ChatRequest,
  apiKey?: string,
  keyChoice?: GeminiKeyChoice,
): AsyncGenerator<StreamChunk, void, unknown> {
  const key = apiKey || getApiKeyFromStorage();
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

  let modelId = req.model || 'gemini-flash-latest';

  // Build contents array
  const contents: any[] = (req.history ?? []).map((m) => ({
    role: m.role === 'model' ? 'model' : 'user',
    parts: [{ text: m.text }],
  }));
  contents.push({
    role: 'user',
    parts: [{ text: req.userInput }],
  });

  // System instruction
  const permMem = (req.permanentMemory || '').trim();
  const langInstr = systemInstructionFor(responseLanguage);
  const systemText = permMem ? `${permMem}\n\n---\n\n${langInstr}` : langInstr;

  const body = {
    contents,
    systemInstruction: { parts: [{ text: systemText }] },
    generationConfig: {
      temperature: 0.8,
      topP: 0.95,
      maxOutputTokens: 1024,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ],
    model: modelId,
    ...(key ? { apiKey: key } : {}),
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (keyChoice) headers['x-gemini-key-choice'] = keyChoice;

  const resp = await fetch(STREAM_API, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: req.signal,
  });

  if (!resp.ok || !resp.body) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(
      data?.error?.message || `Gemini stream failed (HTTP ${resp.status}).`
    );
  }

  // Parse SSE stream
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE events (separated by \n\n)
      const events = buffer.split('\n\n');
      buffer = events.pop() || ''; // Keep incomplete event in buffer

      for (const event of events) {
        const lines = event.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);
            const text =
              data?.candidates?.[0]?.content?.parts
                ?.map((p: any) => p.text || '')
                .join('')
                .trim() || '';

            if (text) {
              fullText += text;
              yield { text, done: false };
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Signal completion
  yield { text: '', done: true };
}

function getApiKeyFromStorage(): string {
  if (typeof window !== 'undefined') {
    const userKey = localStorage.getItem('alisha-gemini-api-key') || '';
    if (userKey.trim()) return userKey.trim();
  }
  return '';
}

/**
 * Build a non-streaming ChatResponse from streaming chunks.
 * Useful for callers that need the final response object.
 */
export function streamToResponse(
  fullText: string,
  detected: ResponseLanguage,
  responseLanguage: ResponseLanguage,
  model: string,
): ChatResponse {
  return {
    text: fullText,
    detectedLanguage: detected,
    responseLanguage,
    model,
  };
}
