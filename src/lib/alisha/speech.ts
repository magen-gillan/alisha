'use client';

/**
 * Speech utilities for Alisha — wraps Web Speech API
 * (SpeechRecognition for STT, SpeechSynthesis for TTS).
 *
 * Falls back gracefully when the browser does not support these APIs.
 */

import type { ResponseLanguage } from './types';
import { localeFor } from './language';

// ---- Types ----

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: { new (): SpeechRecognitionLike };
    webkitSpeechRecognition?: { new (): SpeechRecognitionLike };
  }
}

// ---- State ----

let currentRecognition: SpeechRecognitionLike | null = null;

// ---- Speech-to-Text ----

export interface STTOptions {
  language: ResponseLanguage;
  onResult: (text: string, isFinal: boolean) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

export function isSTTSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function startListening(opts: STTOptions): void {
  if (!isSTTSupported()) {
    opts.onError?.('SpeechRecognition is not supported in this browser.');
    return;
  }

  // Stop any existing session
  stopListening();

  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition!;
  const recognition = new Ctor();
  recognition.lang = localeFor(opts.language);
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => opts.onStart?.();

  recognition.onresult = (event: any) => {
    let interim = '';
    let final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        final += transcript;
      } else {
        interim += transcript;
      }
    }
    if (final) opts.onResult(final.trim(), true);
    else if (interim) opts.onResult(interim.trim(), false);
  };

  recognition.onerror = (event: any) => {
    opts.onError?.(event?.error || 'unknown_error');
  };

  recognition.onend = () => {
    currentRecognition = null;
    opts.onEnd?.();
  };

  currentRecognition = recognition;
  try {
    recognition.start();
  } catch (err) {
    opts.onError?.(String(err));
  }
}

export function stopListening(): void {
  if (currentRecognition) {
    try {
      currentRecognition.stop();
    } catch {
      /* noop */
    }
    currentRecognition = null;
  }
}

// ---- Text-to-Speech ----

export interface TTSOptions {
  text: string;
  language: ResponseLanguage;
  /** BCP-47 locale for TTS (overrides language-based locale). */
  voiceLanguage?: string;
  /** Specific voice URI to use (empty = auto-pick). */
  voiceURI?: string;
  rate?: number;
  pitch?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

export function isTTSSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window;
}

let cachedVoices: SpeechSynthesisVoice[] = [];
let pendingSpeakTimer: ReturnType<typeof setTimeout> | null = null;
let speechGeneration = 0;

export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isTTSSupported()) return resolve([]);
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      cachedVoices = existing;
      return resolve(existing);
    }
    const handler = () => {
      const v = window.speechSynthesis.getVoices();
      cachedVoices = v;
      resolve(v);
    };
    window.speechSynthesis.onvoiceschanged = handler;
    // Fallback in case the event never fires
    setTimeout(() => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) cachedVoices = voices;
      resolve(voices);
    }, 500);
  });
}

export function getVoices(): SpeechSynthesisVoice[] {
  if (!isTTSSupported()) return [];
  const v = window.speechSynthesis.getVoices();
  if (v.length > 0) cachedVoices = v;
  return cachedVoices;
}

/** Returns voices filtered by a BCP-47 language prefix. */
export function getVoicesForLanguage(lang: string): SpeechSynthesisVoice[] {
  const all = getVoices();
  const prefix = lang.toLowerCase().split('-')[0];
  return all.filter((v) => v.lang.toLowerCase().startsWith(prefix));
}

function pickVoice(
  language: ResponseLanguage,
  voiceLanguage?: string,
  voiceURI?: string
): SpeechSynthesisVoice | undefined {
  // 1. If a specific voice URI is set, use it
  if (voiceURI) {
    const v = cachedVoices.find((x) => x.voiceURI === voiceURI);
    if (v) return v;
  }
  // 2. Try exact voiceLanguage match
  if (voiceLanguage) {
    const vl = voiceLanguage.toLowerCase();
    let v = cachedVoices.find((x) => x.lang.toLowerCase() === vl);
    if (v) return v;
    const prefix = vl.split('-')[0];
    v = cachedVoices.find((x) => x.lang.toLowerCase().startsWith(prefix));
    if (v) return v;
  }
  // 3. Fall back to language-based locale
  const locale = localeFor(language).toLowerCase();
  const langPrefix = locale.split('-')[0];
  let voice = cachedVoices.find((v) => v.lang.toLowerCase() === locale);
  if (voice) return voice;
  voice = cachedVoices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
  return voice;
}

export function speak(opts: TTSOptions): void {
  if (!isTTSSupported() || !opts.text.trim()) {
    opts.onEnd?.();
    return;
  }

  // Cancel any in-flight speech and invalidate older delayed utterances.
  speechGeneration += 1;
  const generation = speechGeneration;
  if (pendingSpeakTimer) clearTimeout(pendingSpeakTimer);
  window.speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(opts.text);
  // Prefer voiceLanguage (BCP-47 from Settings) over the response language locale
  utter.lang = opts.voiceLanguage || localeFor(opts.language);
  utter.rate = opts.rate ?? 1.0;
  utter.pitch = opts.pitch ?? 1.0;
  utter.volume = 1.0;

  const voice = pickVoice(opts.language, opts.voiceLanguage, opts.voiceURI);
  if (voice) utter.voice = voice;

  utter.onstart = () => opts.onStart?.();
  utter.onend = () => opts.onEnd?.();
  utter.onerror = (e) => opts.onError?.(e?.error || 'tts_error');

  // Small delay to ensure cancel completes (Chrome quirk)
  pendingSpeakTimer = setTimeout(() => {
    pendingSpeakTimer = null;
    if (generation === speechGeneration) window.speechSynthesis.speak(utter);
  }, 60);
}

export function stopSpeaking(): void {
  speechGeneration += 1;
  if (pendingSpeakTimer) {
    clearTimeout(pendingSpeakTimer);
    pendingSpeakTimer = null;
  }
  if (isTTSSupported()) window.speechSynthesis.cancel();
}

export function isSpeaking(): boolean {
  return isTTSSupported() && window.speechSynthesis.speaking;
}
