'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAlishaStore } from '@/store/alisha-store';
import {
  isSTTSupported,
  isTTSSupported,
  startListening,
  stopListening,
  speak,
  stopSpeaking,
  loadVoices,
} from '@/lib/alisha/speech';
import { detectLanguage } from '@/lib/alisha/language';
import { chatWithGemini } from '@/lib/alisha/gemini-client';

interface VoiceChatButtonProps {
  onSpeakingChange: (speaking: boolean) => void;
  onListeningChange: (listening: boolean) => void;
  onThinkingChange: (thinking: boolean) => void;
}

export default function VoiceChatButton({
  onSpeakingChange,
  onListeningChange,
  onThinkingChange,
}: VoiceChatButtonProps) {
  const [state, setState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const {
    responseLanguage,
    model,
    speechRate,
    speechPitch,
    voiceLanguage,
    voiceURI,
    permanentMemory,
    conversation,
    addMessage,
  } = useAlishaStore();

  // Keep a ref to conversation history for sending to Gemini (only role/text)
  const historyRef = useRef<{ role: 'user' | 'model'; text: string }[]>([]);
  useEffect(() => {
    historyRef.current = conversation.map((m) => ({ role: m.role, text: m.text }));
  }, [conversation]);

  // Preload TTS voices
  useEffect(() => {
    loadVoices();
  }, []);

  // Warn once if browser lacks STT
  useEffect(() => {
    if (!isSTTSupported()) {
      console.warn('SpeechRecognition is not supported in this browser.');
    }
    if (!isTTSSupported()) {
      console.warn('SpeechSynthesis is not supported in this browser.');
    }
  }, []);

  const handleClick = async () => {
    if (state === 'idle') {
      startVoiceConversation();
    } else {
      // Cancel everything, including any in-flight network response.
      requestIdRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
      stopListening();
      stopSpeaking();
      setState('idle');
      onListeningChange(false);
      onSpeakingChange(false);
      onThinkingChange(false);
    }
  };

  const startVoiceConversation = () => {
    if (!isSTTSupported()) {
      toast.error(
        'Voice input is not supported in this browser. Please use Chrome, Edge, or Safari.'
      );
      return;
    }

    setState('listening');
    onListeningChange(true);

    let finalTranscript = '';

    startListening({
      language: responseLanguage,
      onStart: () => {
        toast('Listening… speak now.', { duration: 2000 });
      },
      onResult: (text, isFinal) => {
        if (isFinal) {
          finalTranscript = text;
          stopListening();
          // Move to thinking state
          setState('thinking');
          onListeningChange(false);
          onThinkingChange(true);
          sendToGemini(finalTranscript);
        }
      },
      onError: (err) => {
        console.error('STT error:', err);
        toast.error(`Speech recognition error: ${err}`);
        setState('idle');
        onListeningChange(false);
        onThinkingChange(false);
        onSpeakingChange(false);
      },
      onEnd: () => {
        if (!finalTranscript) {
          setState('idle');
          onListeningChange(false);
        }
      },
    });
  };

  const sendToGemini = async (userText: string) => {
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const detected = detectLanguage(userText);
      console.log(`[VoiceChat] input="${userText}" detected=${detected} → ${responseLanguage}`);

      const chat = await chatWithGemini({
        userInput: userText,
        detectedLanguage: detected,
        responseLanguage,
        model,
        history: historyRef.current,
        permanentMemory,
        signal: controller.signal,
      });

      if (requestId !== requestIdRef.current) return;

      // Add to conversation store
      addMessage({ role: 'user', text: userText, lang: detected });
      addMessage({ role: 'model', text: chat.text, lang: responseLanguage });

      // Speak the response
      setState('speaking');
      onThinkingChange(false);
      onSpeakingChange(true);

      speak({
        text: chat.text,
        language: responseLanguage,
        voiceLanguage,
        voiceURI,
        rate: speechRate,
        pitch: speechPitch,
        onEnd: () => {
          setState('idle');
          onSpeakingChange(false);
        },
        onError: (e) => {
          console.error('TTS error:', e);
          toast.error(`Text-to-speech error: ${e}`);
          setState('idle');
          onSpeakingChange(false);
        },
      });
    } catch (err: any) {
      if (err?.name === 'AbortError' || requestId !== requestIdRef.current) return;
      console.error('[VoiceChat] Gemini error:', err);
      toast.error(err?.message || 'Failed to get a response from Gemini.');
      setState('idle');
      onThinkingChange(false);
      onSpeakingChange(false);
    } finally {
      if (requestId === requestIdRef.current) abortRef.current = null;
    }
  };

  const isBusy = state !== 'idle';

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={state === 'thinking'}
      size="lg"
      className={`relative rounded-full w-20 h-20 sm:w-24 sm:h-24 shadow-xl transition-all duration-300 ${
        state === 'listening'
          ? 'bg-rose-500 hover:bg-rose-600 animate-pulse'
          : state === 'speaking'
          ? 'bg-purple-500 hover:bg-purple-600'
          : state === 'thinking'
          ? 'bg-blue-500 hover:bg-blue-600'
          : 'bg-gradient-to-br from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700'
      }`}
      aria-label={
        state === 'listening'
          ? 'Stop listening'
          : state === 'speaking'
          ? 'Stop speaking'
          : 'Start voice conversation'
      }
    >
      {state === 'thinking' ? (
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      ) : isBusy ? (
        <Square className="w-7 h-7 text-white fill-white" />
      ) : (
        <Mic className="w-8 h-8 text-white" />
      )}
      {/* Pulsing ring when listening */}
      {state === 'listening' && (
        <span className="absolute inset-0 rounded-full border-2 border-rose-300 animate-ping opacity-75" />
      )}
    </Button>
  );
}
