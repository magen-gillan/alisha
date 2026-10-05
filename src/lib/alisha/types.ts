/**
 * Alisha - Shared Types
 */

export type ResponseLanguage = 'en' | 'ar' | 'ja';

export type BackgroundId = 'aurora' | 'sunset' | 'midnight' | 'sakura';

/**
 * Which Live2D avatar to render. Multiple models can coexist in
 * /public/live2d/. Switching is done at runtime in the settings panel.
 */
export type AvatarId = 'kei' | 'jane' | 'icegirl' | 'ganyu' | 'miara';

/**
 * Which AI provider to use for text generation.
 * - `gemini`: Google Gemini via /api/gemini (default, original)
 * - `pollinations`: Pollinations.ai via /api/pollinations
 *
 * TTS is always handled by the browser's Web Speech API regardless of provider.
 */
export type AIProvider = 'gemini' | 'pollinations';

/**
 * Which Gemini server-side key to use as the PRIMARY key.
 * The other key is always kept as an automatic fallback.
 *
 * - `auto`     : Start with GEMINI_API_KEY (the new active key),
 *                fall back to GEMINI_API_KEY_LEGACY on failure.
 *                This is the safe default that keeps the new key first.
 * - `primary`  : Same as `auto` — explicitly use the primary key first.
 * - `legacy`   : Start with GEMINI_API_KEY_LEGACY (the old key),
 *                fall back to GEMINI_API_KEY on failure.
 *                Use this if you want to compare behaviour or if the
 *                primary key is temporarily blocked.
 *
 * The user-supplied client key (if any) ALWAYS overrides the server-side keys.
 */
export type GeminiKeyChoice = 'auto' | 'primary' | 'legacy';

export interface AlishaSettings {
  /** Language Alisha responds in (regardless of input language). */
  responseLanguage: ResponseLanguage;
  /** Currently selected background. */
  background: BackgroundId;
  /** Selected Live2D avatar. */
  avatarId: AvatarId;
  /** Selected Gemini model ID. */
  model: string;
  /** Selected Pollinations model ID (used when provider='pollinations'). */
  pollinationsModel: string;
  /** Active AI provider. */
  provider: AIProvider;
  /** Which Gemini server key to prefer when no client key is set. */
  geminiKeyChoice: GeminiKeyChoice;
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

export const GEMINI_KEY_CHOICE_LABELS: Record<GeminiKeyChoice, string> = {
  auto: 'تلقائي',
  primary: 'المفتاح الأساسي (الجديد)',
  legacy: 'المفتاح القديم (احتياطي)',
};

export const GEMINI_KEY_CHOICE_DESCRIPTIONS: Record<GeminiKeyChoice, string> = {
  auto: 'يبدأ بالمفتاح الأساسي الجديد، ثم ينتقل للقديم عند فشله تلقائياً.',
  primary: 'يستخدم المفتاح الأساسي الجديد فقط (مع fallback للمفتاح القديم).',
  legacy: 'يبدأ بالمفتاح القديم، ثم ينتقل للجديد عند فشله. مفيد للمقارنة أو عند فشل الأساسي مؤقتاً.',
};

/** Voice language options for TTS. */
export const VOICE_LANGUAGES: { value: string; label: string; native: string }[] = [
  { value: 'ar-SA', label: 'Arabic (Saudi)', native: 'العربية' },
  { value: 'ar-EG', label: 'Arabic (Egypt)', native: 'العربية (مصر)' },
  { value: 'ja-JP', label: 'Japanese', native: '日本語' },
  { value: 'en-US', label: 'English (US)', native: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)', native: 'English (UK)' },
];
