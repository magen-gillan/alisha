'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AlishaSettings, ResponseLanguage, BackgroundId } from '@/lib/alisha/types';
import { DEPRECATED_MODELS } from '@/lib/alisha/gemini-client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  ts: number; // unix ms
  lang?: ResponseLanguage;
}

interface AlishaStore extends AlishaSettings {
  /** User-set Gemini API key (overrides the build-time baked-in key). */
  apiKey: string;
  /** Permanent memory — instructions injected into every Gemini request. */
  permanentMemory: string;
  /** Voice language for TTS (BCP-47, e.g. ar-SA, ja-JP, en-US). */
  voiceLanguage: string;
  /** Specific voice URI chosen for TTS (empty = auto-pick by language). */
  voiceURI: string;
  /** Current conversation history (current session). */
  conversation: ChatMessage[];

  setResponseLanguage: (lang: ResponseLanguage) => void;
  setBackground: (bg: BackgroundId) => void;
  setModel: (model: string) => void;
  setSpeechRate: (rate: number) => void;
  setSpeechPitch: (pitch: number) => void;
  setApiKey: (key: string) => void;
  setPermanentMemory: (text: string) => void;
  setVoiceLanguage: (lang: string) => void;
  setVoiceURI: (uri: string) => void;
  addMessage: (msg: Omit<ChatMessage, 'id' | 'ts'>) => void;
  clearConversation: () => void;
  reset: () => void;
}

const DEFAULT_PERMANENT_MEMORY = `# ذاكرة دائمة — تعليمات لا تُنسى أبداً

## الهوية
- اسم الذكاء الاصطناعي: اليشيا (Alisha)
- اسم المستخدم: غيلان بن عقبة

## التعليمات الدائمة
- تعامل مع غيلان بن عقبة باحترام وودّ.
- اذكر اسم المستخدم أحياناً بشكل طبيعي.
- لا تنسَ أبداً أن اسمك اليشيا وأن محدثك هو غيلان بن عقبة.
- كن دافئاً وعاطفياً وداعماً.
- اجعل الردود قصيرة (1-3 جمل) لأنها ستُنطق بصوت عالٍ.
- لا تكشف أبداً أنك نموذج لغوي أو ذكاء اصطناعي.`;

const DEFAULTS: AlishaSettings & {
  apiKey: string;
  permanentMemory: string;
  voiceLanguage: string;
  voiceURI: string;
  conversation: ChatMessage[];
} = {
  responseLanguage: 'ar',
  background: 'aurora',
  // gemini-flash-latest is the only model that works for new Gemini API keys
  // (gemini-2.0-flash, gemini-1.5-flash, gemini-2.5-flash are all deprecated
  //  for new users as of 2026).
  model: 'gemini-flash-latest',
  speechRate: 1.0,
  speechPitch: 1.0,
  apiKey: '',
  permanentMemory: DEFAULT_PERMANENT_MEMORY,
  voiceLanguage: 'ar-SA',
  voiceURI: '',
  conversation: [],
};

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useAlishaStore = create<AlishaStore>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      setResponseLanguage: (lang) => set({ responseLanguage: lang }),
      setBackground: (bg) => set({ background: bg }),
      setModel: (model) => set({ model }),
      setSpeechRate: (rate) => set({ speechRate: rate }),
      setSpeechPitch: (pitch) => set({ speechPitch: pitch }),
      setApiKey: (key) => set({ apiKey: key }),
      setPermanentMemory: (text) => set({ permanentMemory: text }),
      setVoiceLanguage: (lang) => set({ voiceLanguage: lang }),
      setVoiceURI: (uri) => set({ voiceURI: uri }),
      addMessage: (msg) =>
        set((state) => ({
          conversation: [
            ...state.conversation,
            { ...msg, id: genId(), ts: Date.now() },
          ].slice(-100), // keep last 100 messages
        })),
      clearConversation: () => set({ conversation: [] }),
      reset: () =>
        set({
          ...DEFAULTS,
          permanentMemory: DEFAULT_PERMANENT_MEMORY,
        }),
    }),
    {
      name: 'alisha-settings',
      version: 5,
      // Don't persist conversation across reloads (it's "current session")
      partialize: (state) => ({
        responseLanguage: state.responseLanguage,
        background: state.background,
        model: state.model,
        speechRate: state.speechRate,
        speechPitch: state.speechPitch,
        apiKey: state.apiKey,
        permanentMemory: state.permanentMemory,
        voiceLanguage: state.voiceLanguage,
        voiceURI: state.voiceURI,
        // Intentionally omit `conversation` so each page load starts fresh
      }),
      migrate: (persisted: any, version: number) => {
        // v3 → v4 (and any future version): replace any deprecated model
        // name with gemini-flash-latest. gemini-2.x and gemini-1.5 are all
        // deprecated for new Gemini API keys as of 2026.
        if (persisted && typeof persisted.model === 'string') {
          if (DEPRECATED_MODELS.has(persisted.model)) {
            persisted.model = 'gemini-flash-latest';
          }
        }
        return persisted;
      },
    }
  )
);

export { DEFAULT_PERMANENT_MEMORY };
