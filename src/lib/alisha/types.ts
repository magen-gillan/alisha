/**
 * Alisha - Shared Types
 */

export type ResponseLanguage = 'en' | 'ar' | 'ja';

export type BackgroundId = 'aurora' | 'sunset' | 'midnight' | 'sakura';

/**
 * Which AI provider to use for text generation.
 * - `gemini`: Google Gemini via /api/gemini (default, original)
 * - `pollinations`: Pollinations.ai via /api/pollinations
 *
 * TTS is always handled by the browser's Web Speech API regardless of provider.
 */
export type AIProvider = 'gemini' | 'pollinations';

export interface AlishaSettings {
  /** Language Alisha responds in (regardless of input language). */
  responseLanguage: ResponseLanguage;
  /** Currently selected background. */
  background: BackgroundId;
  /** Selected Gemini model ID. */
  model: string;
  /** Selected Pollinations model ID (used when provider='pollinations'). */
  pollinationsModel: string;
  /** Active AI provider. */
  provider: AIProvider;
  /** Speech rate for TTS (0.5 - 2.0). */
  speechRate: number;
  /** Speech pitch for TTS (0 - 2). */
  speechPitch: number;
}

/**
 * A single AI model entry from either Gemini or Pollinations.
 * Used to populate the model picker in the settings panel.
 */
export interface GeminiModel {
  name: string;
  displayName: string;
  description?: string;
  /** Methods supported by this model (e.g. generateContent). */
  supportedMethods?: string[];
  /** Modality flags (e.g. ["text","audio","vision"]). */
  inputModalities?: string[];
  outputModalities?: string[];
  /** Whether the model supports tool calling. */
  tools?: boolean;
}

export interface ChatRequest {
  userInput: string;
  detectedLanguage: ResponseLanguage;
  responseLanguage: ResponseLanguage;
  model: string;
  history?: { role: 'user' | 'model'; text: string }[];
  /** Permanent memory text injected as system instruction. */
  permanentMemory?: string;
  signal?: AbortSignal;
}

export interface ChatResponse {
  text: string;
  detectedLanguage: ResponseLanguage;
  responseLanguage: ResponseLanguage;
  model: string;
}

export const LANGUAGE_LABELS: Record<ResponseLanguage, string> = {
  en: 'English',
  ar: 'العربية',
  ja: '日本語',
};

export const LANGUAGE_NATIVE_LABELS: Record<ResponseLanguage, string> = {
  en: 'English',
  ar: 'العربية',
  ja: '日本語',
};

export const BACKGROUND_LABELS: Record<BackgroundId, string> = {
  aurora: 'الشفق البنفسجي',
  sunset: 'حديقة الساكورا',
  midnight: 'سطح ضوء القمر',
  sakura: 'غرفة السحاب',
};

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  gemini: 'Gemini',
  pollinations: 'Pollinations',
};

export const PROVIDER_DESCRIPTIONS: Record<AIProvider, string> = {
  gemini: 'Google Gemini AI — نماذج Flash و Pro',
  pollinations: 'Pollinations.ai — مزود مجاني بمفتاح اختياري، يدعم GPT وغيرها',
};

/** Voice language options for TTS. */
export const VOICE_LANGUAGES: { value: string; label: string; native: string }[] = [
  { value: 'ar-SA', label: 'Arabic (Saudi)', native: 'العربية' },
  { value: 'ar-EG', label: 'Arabic (Egypt)', native: 'العربية (مصر)' },
  { value: 'ja-JP', label: 'Japanese', native: '日本語' },
  { value: 'en-US', label: 'English (US)', native: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)', native: 'English (UK)' },
];
