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
  /** Provider keys for the unified LLM router (from FreeLLMAPI integration). */
  providerKeys: Record<string, string>;
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
  setProviderKeys: (keys: Record<string, string>) => void;
  updateProviderKey: (providerId: string, key: string) => void;
  removeProviderKey: (providerId: string) => void;
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
  providerKeys: Record<string, string>;
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
  providerKeys: {},
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
      setProviderKeys: (keys) => set({ providerKeys: keys }),
      updateProviderKey: (providerId, key) =>
        set((state) => ({
          providerKeys: { ...state.providerKeys, [providerId]: key },
        })),
      removeProviderKey: (providerId) =>
        set((state) => {
          const keys = { ...state.providerKeys };
          delete keys[providerId];
          return { providerKeys: keys };
        }),
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
          providerKeys: {},
          conversation: [],
          permanentMemory: DEFAULT_PERMANENT_MEMORY,
        }),
    }),
    {
      name: 'alisha-settings',
      version: 11,
      partialize: (state) => ({
        responseLanguage: state.responseLanguage,
        background: state.background,
        avatarId: state.avatarId,
        theme: state.theme,
        model: state.model,
        providerKeys: state.providerKeys,
        speechRate: state.speechRate,
        speechPitch: state.speechPitch,
        permanentMemory: state.permanentMemory,
        voiceLanguage: state.voiceLanguage,
        voiceURI: state.voiceURI,
        conversation: state.conversation,
      }),
      migrate: (persisted: any, version: number) => {
        if (!persisted) return persisted;
        // v10 → v11: migrate from old provider/key system to unified providerKeys
        const oldKeys: Record<string, string> = {};
        if (typeof persisted.apiKey === 'string' && persisted.apiKey.trim()) {
          oldKeys['google'] = persisted.apiKey;
        }
        if (typeof persisted.pollinationsApiKey === 'string' && persisted.pollinationsApiKey.trim()) {
          oldKeys['pollinations'] = persisted.pollinationsApiKey;
        }
        persisted.providerKeys = oldKeys;
        // Remove old fields
        delete persisted.apiKey;
        delete persisted.pollinationsApiKey;
        delete persisted.provider;
        delete persisted.geminiKeyChoice;
        delete persisted.pollinationsModel;
        // Ensure new fields exist
        if (typeof persisted.model !== 'string') persisted.model = '';
        return persisted;
      },
    }
  )
);

export { DEFAULT_PERMANENT_MEMORY };
