'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AlishaSettings, ResponseLanguage, BackgroundId, AIProvider, GeminiKeyChoice, AvatarId } from '@/lib/alisha/types';
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
  /** User-set Pollinations API key (optional; anonymous tier is the fallback). */
  pollinationsApiKey: string;
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
  setAvatarId: (id: AvatarId) => void;
  setModel: (model: string) => void;
  setPollinationsModel: (model: string) => void;
  setProvider: (provider: AIProvider) => void;
  setGeminiKeyChoice: (choice: GeminiKeyChoice) => void;
  setSpeechRate: (rate: number) => void;
  setSpeechPitch: (pitch: number) => void;
  setApiKey: (key: string) => void;
  setPollinationsApiKey: (key: string) => void;
  setPermanentMemory: (text: string) => void;
  setVoiceLanguage: (lang: string) => void;
  setVoiceURI: (uri: string) => void;
  addMessage: (msg: Omit<ChatMessage, 'id' | 'ts'>) => void;
  removeLastUserMessage: (text: string) => void;
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
  pollinationsApiKey: string;
  permanentMemory: string;
  voiceLanguage: string;
  voiceURI: string;
  conversation: ChatMessage[];
} = {
  responseLanguage: 'ar',
  background: 'aurora',
  avatarId: 'kei',
  // gemini-flash-latest is the only model that works for new Gemini API keys
  // (gemini-2.0-flash, gemini-1.5-flash, gemini-2.5-flash are all deprecated
  //  for new users as of 2026).
  model: 'gemini-flash-latest',
  // Pollinations: openai-fast is always available (anonymous tier).
  pollinationsModel: 'openai-fast',
  // Default provider is Gemini (preserves existing user behaviour).
  provider: 'gemini',
  // Default: prefer the new (primary) server key, fall back to legacy.
  geminiKeyChoice: 'auto',
  speechRate: 1.0,
  speechPitch: 1.0,
  apiKey: '',
  pollinationsApiKey: '',
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
      setAvatarId: (id) => set({ avatarId: id }),
      setModel: (model) => set({ model }),
      setPollinationsModel: (model) => set({ pollinationsModel: model }),
      setProvider: (provider) => set({ provider }),
      setGeminiKeyChoice: (choice) => set({ geminiKeyChoice: choice }),
      setSpeechRate: (rate) => set({ speechRate: rate }),
      setSpeechPitch: (pitch) => set({ speechPitch: pitch }),
      setApiKey: (key) => set({ apiKey: key }),
      setPollinationsApiKey: (key) => set({ pollinationsApiKey: key }),
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
      removeLastUserMessage: (text) =>
        set((state) => {
          const reversedIndex = [...state.conversation].reverse().findIndex(
            (message) => message.role === 'user' && message.text === text,
          );
          if (reversedIndex < 0) return state;
          const actualIndex = state.conversation.length - 1 - reversedIndex;
          return {
            conversation: state.conversation.filter((_, index) => index !== actualIndex),
          };
        }),
      clearConversation: () => set({ conversation: [] }),
      reset: () =>
        set({
          ...DEFAULTS,
          permanentMemory: DEFAULT_PERMANENT_MEMORY,
        }),
    }),
    {
      name: 'alisha-settings',
      version: 9,
      // Persist conversation across reloads too — the user often wants to
      // continue where they left off after closing the tab.
      partialize: (state) => ({
        responseLanguage: state.responseLanguage,
        background: state.background,
        avatarId: state.avatarId,
        model: state.model,
        pollinationsModel: state.pollinationsModel,
        provider: state.provider,
        geminiKeyChoice: state.geminiKeyChoice,
        speechRate: state.speechRate,
        speechPitch: state.speechPitch,
        apiKey: state.apiKey,
        pollinationsApiKey: state.pollinationsApiKey,
        permanentMemory: state.permanentMemory,
        voiceLanguage: state.voiceLanguage,
        voiceURI: state.voiceURI,
        conversation: state.conversation,
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
        // v5 → v6: add Pollinations provider settings with sensible defaults
        // if missing, but NEVER override what the user explicitly set.
        if (!persisted) return persisted;
        if (typeof persisted.provider !== 'string') {
          persisted.provider = 'gemini';
        }
        if (typeof persisted.pollinationsModel !== 'string' || !persisted.pollinationsModel) {
          persisted.pollinationsModel = 'openai-fast';
        }
        if (typeof persisted.pollinationsApiKey !== 'string') {
          persisted.pollinationsApiKey = '';
        }
        // v6 → v7: add Gemini key choice. Default to 'auto' for existing users
        // so they keep the same behaviour (primary first, legacy fallback).
        if (typeof persisted.geminiKeyChoice !== 'string' ||
            !['auto', 'primary', 'legacy'].includes(persisted.geminiKeyChoice)) {
          persisted.geminiKeyChoice = 'auto';
        }
        // v8 → v9: add avatarId. Default to 'kei' for existing users so they
        // don't see any visual change.
        if (typeof persisted.avatarId !== 'string' ||
            !['kei', 'jane', 'icegirl', 'ganyu', 'miara'].includes(persisted.avatarId)) {
          persisted.avatarId = 'kei';
        }
        return persisted;
      },
    }
  )
);

export { DEFAULT_PERMANENT_MEMORY };
