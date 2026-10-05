/**
 * Conversation export / share helpers.
 *
 * Generates a plain-text transcript of the current conversation that can be:
 *   - Downloaded as a .txt file
 *   - Shared via the Web Share API (mobile)
 */

import type { ChatMessage } from '@/store/alisha-store';
import type { ResponseLanguage } from './types';

function formatDate(ts: number, lang: ResponseLanguage = 'ar'): string {
  try {
    const locale = lang === 'ar' ? 'ar-SA' : lang === 'ja' ? 'ja-JP' : 'en-US';
    return new Date(ts).toLocaleString(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return new Date(ts).toISOString();
  }
}

/** Build a plain-text transcript of the conversation. */
export function buildTranscript(
  messages: ChatMessage[],
  lang: ResponseLanguage = 'ar',
): string {
  const header = 'Alisha — Conversation Transcript\n' +
                 `Generated: ${formatDate(Date.now(), lang)}\n` +
                 `Messages: ${messages.length}\n` +
                 '─'.repeat(40) + '\n\n';
  const body = messages
    .map((m) => {
      const speaker = m.role === 'user' ? 'You' : 'Alisha';
      return `[${formatDate(m.ts, lang)}] ${speaker}:\n${m.text}\n`;
    })
    .join('\n');
  return header + body;
}

/** Trigger a download of the transcript as a .txt file. */
export function downloadTranscript(
  messages: ChatMessage[],
  lang: ResponseLanguage = 'ar',
): void {
  if (typeof window === 'undefined') return;
  const transcript = buildTranscript(messages, lang);
  const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.download = `alisha-conversation-${stamp}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Try to share via Web Share API; fall back to download if unavailable. */
export async function shareOrDownload(
  messages: ChatMessage[],
  lang: ResponseLanguage = 'ar',
): Promise<void> {
  if (typeof navigator === 'undefined') {
    downloadTranscript(messages, lang);
    return;
  }
  if (navigator.share) {
    try {
      const transcript = buildTranscript(messages, lang);
      await navigator.share({
        title: 'Alisha Conversation',
        text: transcript,
      });
      return;
    } catch (err: any) {
      // User cancelled or share failed → fall through to download.
      if (err?.name === 'AbortError') return;
    }
  }
  downloadTranscript(messages, lang);
}
