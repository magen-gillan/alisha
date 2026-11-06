'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AlishaSettings, ResponseLanguage, BackgroundId, AvatarId, AppTheme } from '@/lib/alisha/types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  ts: number; // unix ms
  lang?: ResponseLanguage;
}

interface AlishaStore extends AlishaSettings {
  /** Permanent memory — instructions injected into every request. */
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
  setTheme: (theme: AppTheme) => void;
  setProviderId: (providerId: string) => void;
  setModel: (model: string) => void;
  setSpeechRate: (rate: number) => void;
  setSpeechPitch: (pitch: number) => void;
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
- اسم الذكاء الاصطناعي: Alisha
- اسم المستخدم: غيلان بن عقبة

## التعليمات الدائمة
- تعامل مع غيلان بن عقبة باحترام وودّ.
- اذكر اسم المستخدم أحياناً بشكل طبيعي.
- لا تنسَ أبداً أن اسمك Alisha وأن محدثك هو غيلان بن عقبة.
- كن دافئاً وعاطفياً وداعماً.
- اجعل الردود قصيرة (1-3 جمل) لأنها ستُنطق بصوت عالٍ.
- لا تكشف أبداً أنك نموذج لغوي أو ذكاء اصطناعي.`;

const DEFAULTS: AlishaSettings & {
  permanentMemory: string;
  voiceLanguage: string;
  voiceURI: string;
  conversation: ChatMessage[];
} = {
  responseLanguage: 'ar',
  background: 'aurora',
  avatarId: 'kei',
  theme: 'dark',
  model: '',
  providerId: 'google',
  speechRate: 1.0,
  speechPitch: 1.0,
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
      setTheme: (theme) => set({ theme }),
      setProviderId: (providerId) => set({ providerId, model: '' }),
      setModel: (model) => set({ model }),
      setSpeechRate: (rate) => set({ speechRate: rate }),
      setSpeechPitch: (pitch) => set({ speechPitch: pitch }),
      setPermanentMemory: (text) => set({ permanentMemory: text }),
      setVoiceLanguage: (lang) => set({ voiceLanguage: lang }),
      setVoiceURI: (uri) => set({ voiceURI: uri }),
      addMessage: (msg) =>
        set((state) => ({
          conversation: [
            ...state.conversation,
            { ...msg, id: genId(), ts: Date.now() },
          ].slice(-100),
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
          conversation: [],
          permanentMemory: DEFAULT_PERMANENT_MEMORY,
        }),
    }),
    {
      name: 'alisha-settings',
      version: 13,
      partialize: (state) => ({
        responseLanguage: state.responseLanguage,
        background: state.background,
        avatarId: state.avatarId,
        theme: state.theme,
        model: state.model,
        providerId: state.providerId,
        speechRate: state.speechRate,
        speechPitch: state.speechPitch,
        permanentMemory: state.permanentMemory,
        voiceLanguage: state.voiceLanguage,
        voiceURI: state.voiceURI,
        conversation: state.conversation,
      }),
      migrate: (persisted: any, version: number) => {
        if (!persisted) return persisted;
        if (version < 11) {
          // v10 → v11: migrate old keys without discarding already unified keys.
          const oldKeys: Record<string, string> = { ...(persisted.providerKeys || {}) };
          if (typeof persisted.apiKey === 'string' && persisted.apiKey.trim()) oldKeys.google = persisted.apiKey;
          if (typeof persisted.pollinationsApiKey === 'string' && persisted.pollinationsApiKey.trim()) oldKeys.pollinations = persisted.pollinationsApiKey;
          persisted.providerKeys = oldKeys;
          delete persisted.apiKey;
          delete persisted.pollinationsApiKey;
          delete persisted.provider;
          delete persisted.geminiKeyChoice;
          delete persisted.pollinationsModel;
        }
        if (version < 12) {
          const voiceLocales = ['ar-SA', 'ar-EG', 'ja-JP', 'en-US', 'en-GB'];
          if (!['ar', 'en', 'ja'].includes(persisted.responseLanguage)) persisted.responseLanguage = 'ar';
          if (!voiceLocales.includes(persisted.voiceLanguage)) {
            persisted.voiceLanguage = persisted.responseLanguage === 'ja' ? 'ja-JP' : persisted.responseLanguage === 'en' ? 'en-US' : 'ar-SA';
            persisted.voiceURI = '';
          }
        }
        if (version < 13) {
          // Provider secrets are server-managed now; discard any browser copies.
          delete persisted.providerKeys;
          delete persisted.apiKey;
          delete persisted.pollinationsApiKey;
          persisted.providerId = 'google';
        }
        // Ensure new fields exist
        if (typeof persisted.model !== 'string') persisted.model = '';
        if (typeof persisted.providerId !== 'string') persisted.providerId = 'google';
        return persisted;
      },
    }
  )
);

export { DEFAULT_PERMANENT_MEMORY };
