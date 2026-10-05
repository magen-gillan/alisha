/**
 * Token-aware conversation trimming.
 *
 * Rough heuristic: 1 token ≈ 4 characters of English text. For Arabic and
 * Japanese the ratio is closer to 1 token ≈ 2 characters. We use a
 * conservative middle-ground (1 token ≈ 3 chars) and aim for a budget
 * below 8,000 input tokens — well within Gemini Flash's 1M-token limit,
 * leaving plenty of room for the response and system instruction.
 *
 * The most recent messages are ALWAYS kept; older ones are dropped first.
 */

import type { ChatMessage } from '@/store/alisha-store';

const DEFAULT_TOKEN_BUDGET = 6000;
const CHARS_PER_TOKEN = 3;

/** Estimate the token count of a single message. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Round up to the nearest token.
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Trim a conversation to fit within a token budget.
 * Always keeps the most recent messages; drops older ones first.
 */
export function trimConversationToTokens(
  messages: ChatMessage[],
  budget: number = DEFAULT_TOKEN_BUDGET,
): ChatMessage[] {
  if (messages.length === 0) return [];

  // Walk from the most recent message backwards, accumulating tokens.
  const reversed: ChatMessage[] = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const t = estimateTokens(m.text) + 4; // +4 overhead per message envelope
    if (used + t > budget && reversed.length > 0) break;
    used += t;
    reversed.unshift(m);
  }
  return reversed;
}

/**
 * Build the history payload for the AI provider from the persisted
 * conversation. Trims to fit the token budget.
 *
 * Accepts either full ChatMessage objects (with id/ts/lang) or partial
 * {role, text} objects — we only read role and text anyway.
 */
export function buildHistory(
  messages: Array<{ role: 'user' | 'model'; text: string }>,
  budget: number = DEFAULT_TOKEN_BUDGET,
): { role: 'user' | 'model'; text: string }[] {
  const trimmed = trimConversationToTokens(messages as ChatMessage[], budget);
  return trimmed.map((m) => ({ role: m.role, text: m.text }));
}
