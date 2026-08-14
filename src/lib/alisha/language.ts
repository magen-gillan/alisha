/**
 * Lightweight language detection for Alisha.
 *
 * Supports detection of the three target response languages:
 * - Arabic (ar)
 * - Japanese (ja)
 * - English (en) — default fallback
 *
 * Uses Unicode block heuristics which are 99%+ accurate for
 * distinguishing these three scripts, with no external dependency.
 */

import type { ResponseLanguage } from './types';

const ARABIC_RANGE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const JAPANESE_RANGE = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF]/;
const KOREAN_RANGE = /[\uAC00-\uD7AF\u1100-\u11FF]/;
const CYRILLIC_RANGE = /[\u0400-\u04FF]/;

export function detectLanguage(text: string): ResponseLanguage {
  if (!text || !text.trim()) return 'en';

  // Arabic script (covers Arabic, Persian, Urdu) → respond in Arabic
  if (ARABIC_RANGE.test(text)) return 'ar';

  // Japanese scripts (Hiragana / Katakana / Kanji) → respond in Japanese
  if (JAPANESE_RANGE.test(text)) return 'ja';

  // Korean & Cyrillic are detected but we fall back to English
  // since Alisha only supports {en, ar, ja} as response languages.
  if (KOREAN_RANGE.test(text)) return 'en';
  if (CYRILLIC_RANGE.test(text)) return 'en';

  // Default to English for Latin and everything else
  return 'en';
}

/**
 * Returns the BCP-47 locale tag suitable for SpeechSynthesis /
 * SpeechRecognition for the given response language.
 */
export function localeFor(lang: ResponseLanguage): string {
  switch (lang) {
    case 'ar':
      return 'ar-SA';
    case 'ja':
      return 'ja-JP';
    case 'en':
    default:
      return 'en-US';
  }
}

/**
 * Returns the human-readable system instruction fragment that tells
 * Gemini to respond ONLY in the chosen language.
 *
 * NOTE: Identity / personality / permanent instructions are now provided
 * by the user via the "Permanent Memory" settings panel. This function
 * only returns the language-forcing instruction.
 */
export function systemInstructionFor(lang: ResponseLanguage): string {
  const lines: Record<ResponseLanguage, string> = {
    en: 'You MUST respond ONLY in English. Keep responses short (1-3 sentences) because they will be spoken aloud via TTS.',
    ar: 'يجب أن ترد باللغة العربية فقط، بأسلوب طبيعي ودافئ. اجعل الرد قصيراً (1-3 جمل) لأنه سيُنطق بصوت عالٍ.',
    ja: '日本語でのみ回答してください。自然で温かい話し口調で。回答は短く（1〜3文）してください。音声合成で読み上げられます。',
  };
  return lines[lang];
}
