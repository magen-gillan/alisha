'use client';

import { useState, useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Keyboard, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAlishaStore } from '@/store/alisha-store';
import {
  isTTSSupported,
  speak,
  stopSpeaking,
  loadVoices,
} from '@/lib/alisha/speech';
import { detectLanguage } from '@/lib/alisha/language';
import { chatWithGemini } from '@/lib/alisha/gemini-client';
import { chatWithPollinations } from '@/lib/alisha/pollinations-client';
import { chatWithGeminiStream } from '@/lib/alisha/gemini-stream-client';
import { buildHistory } from '@/lib/alisha/context-window';
import { detectEmotion, type Emotion } from '@/lib/alisha/emotion';

interface TextChatButtonProps {
  onSpeakingChange: (speaking: boolean) => void;
  onThinkingChange: (thinking: boolean) => void;
  setEmotionRef?: React.MutableRefObject<((emotion: Emotion) => void) | null>;
}

export default function TextChatButton({
  onSpeakingChange,
  onThinkingChange,
  setEmotionRef,
}: TextChatButtonProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  // Track the most recent submitted text so handleCancel can restore it.
  const lastSubmittedTextRef = useRef<string>('');
  const {
    responseLanguage,
    model,
    pollinationsModel,
    provider,
    apiKey,
    pollinationsApiKey,
    geminiKeyChoice,
    speechRate,
    speechPitch,
    voiceLanguage,
    voiceURI,
    permanentMemory,
    conversation,
    addMessage,
    removeLastUserMessage,
  } = useAlishaStore();

  // Keep a ref to conversation history for sending to Gemini
  const historyRef = useRef<{ role: 'user' | 'model'; text: string }[]>([]);
  useEffect(() => {
    historyRef.current = conversation.map((m) => ({ role: m.role, text: m.text }));
  }, [conversation]);

  useEffect(() => {
    loadVoices();
  }, []);

  // Focus the textarea when opened
  useEffect(() => {
    if (open && textareaRef.current) {
      // Slight delay to let the keyboard open first
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || thinking) return;

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    lastSubmittedTextRef.current = text;
    setInput('');
    setThinking(true);
    addMessage({ role: 'user', text, lang: detectLanguage(text) });
    onThinkingChange(true);

    try {
      const detected = detectLanguage(text);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[TextChat] lang=${detected} → ${responseLanguage} via ${provider} (${text.length} chars)`);
      }

      const chatReq = {
        userInput: text,
        detectedLanguage: detected,
        responseLanguage,
        model: provider === 'pollinations' ? pollinationsModel : model,
        history: buildHistory(conversation),
        permanentMemory,
        signal: controller.signal,
      };

      // Use streaming for Gemini, non-streaming for Pollinations.
      let fullText = '';
      if (provider === 'pollinations') {
        const chat = await chatWithPollinations(chatReq, pollinationsApiKey || undefined);
        fullText = chat.text;
      } else {
        // Stream Gemini responses — show text as it arrives
        try {
          for await (const chunk of chatWithGeminiStream(chatReq, apiKey || undefined, geminiKeyChoice)) {
            if (requestId !== requestIdRef.current) return;
            if (chunk.text) {
              fullText += chunk.text;
            }
          }
        } catch (streamErr: any) {
          // Fallback to non-streaming if stream fails
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[TextChat] stream failed, falling back to non-stream:', streamErr?.message);
          }
          const chat = await chatWithGemini(chatReq, apiKey || undefined, geminiKeyChoice);
          fullText = chat.text;
        }
      }

      if (requestId !== requestIdRef.current) return;

      // Add only the model response; the user message was saved before the request.
      addMessage({ role: 'model', text: fullText, lang: responseLanguage });

      // Detect emotion from the AI response and apply to avatar
      const emotion = detectEmotion(fullText);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[TextChat] emotion: ${emotion}`);
      }
      setEmotionRef?.current?.(emotion);

      setThinking(false);
      onThinkingChange(false);
      onSpeakingChange(true);

      if (!isTTSSupported()) {
        toast.error('Text-to-speech is not supported in this browser.');
        onSpeakingChange(false);
        return;
      }

      speak({
        text: fullText,
        language: responseLanguage,
        voiceLanguage,
        voiceURI,
        rate: speechRate,
        pitch: speechPitch,
        onStart: () => onSpeakingChange(true),
        onEnd: () => onSpeakingChange(false),
        onError: (e) => {
          console.error('TTS error:', e);
          toast.error(`Text-to-speech error: ${e}`);
          onSpeakingChange(false);
        },
      });
    } catch (err: any) {
      if (err?.name === 'AbortError' || requestId !== requestIdRef.current) return;
      setInput(text);
      removeLastUserMessage(text);
      console.error(`[TextChat] ${provider} error:`, err);
      const providerLabel = provider === 'pollinations' ? 'Pollinations' : 'Gemini';
      toast.error(err?.message || `Failed to get a response from ${providerLabel}.`);
      setThinking(false);
      onThinkingChange(false);
      onSpeakingChange(false);
    } finally {
      if (requestId === requestIdRef.current) abortRef.current = null;
    }
  };

  const handleCancel = () => {
    requestIdRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    stopSpeaking();
    setThinking(false);
    onThinkingChange(false);
    onSpeakingChange(false);
    // Restore the in-flight text so the user doesn't lose what they typed.
    const lastUserMsg = lastSubmittedTextRef.current;
    if (lastUserMsg) {
      setInput(lastUserMsg);
      lastSubmittedTextRef.current = '';
    }
    toast('تم إيقاف الرد');
  };

  const handleClose = () => {
    setOpen(false);
    setInput('');
    // Blur the textarea to dismiss the keyboard
    textareaRef.current?.blur();
  };

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close text input' : 'Type a message'}
        className={`group relative inline-flex items-center justify-center rounded-full w-16 h-16 sm:w-20 sm:h-20 shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
          open
            ? 'bg-rose-500 hover:bg-rose-400 shadow-rose-500/60 shadow-[0_0_35px_rgba(244,63,94,0.6)]'
            : 'bg-gradient-to-br from-indigo-500 to-blue-600 hover:from-indigo-400 hover:to-blue-500 hover:shadow-[0_0_35px_rgba(99,102,241,0.6)] shadow-indigo-900/30'
        }`}
      >
        {/* Gradient ring on hover */}
        {!open && (
          <span className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-60" />
        )}
        <span className="relative z-10">
          {open ? (
            <X className="w-7 h-7 text-white" />
          ) : (
            <Keyboard className="w-7 h-7 text-white transition-transform duration-300 group-hover:scale-110" />
          )}
        </span>
      </button>

      {/* Bottom-docked input panel — appears above the buttons.
          Positioned using fixed bottom offset so it stays visible above
          the mobile keyboard (which uses visualViewport). */}
      {open && (
        <div
          className="fixed left-0 right-0 z-30 px-3 pb-2 animate-in slide-in-from-bottom duration-200"
          style={{ bottom: '96px' }}
        >
          <div className="mx-auto max-w-2xl rounded-2xl border border-white/20 bg-zinc-900/90 backdrop-blur-md shadow-2xl p-3">
            <div className="flex items-end gap-2">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder=""
                rows={2}
                disabled={thinking}
                className="flex-1 resize-none bg-transparent text-white placeholder:text-white/40 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base min-h-[60px]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                  if (e.key === 'Escape') {
                    handleClose();
                  }
                }}
              />
              <button
                type="button"
                onClick={thinking ? handleCancel : handleSubmit}
                disabled={thinking ? false : !input.trim()}
                aria-label={thinking ? 'Cancel response' : 'Send'}
                className={`group relative inline-flex items-center justify-center rounded-full w-11 h-11 shrink-0 transition-all duration-300 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 disabled:opacity-40 disabled:hover:scale-100 ${
                  thinking
                    ? 'bg-rose-500 hover:bg-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.6)]'
                    : 'bg-gradient-to-br from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 hover:shadow-[0_0_20px_rgba(217,70,239,0.6)]'
                }`}
              >
                <span className="relative z-10">
                  {thinking ? (
                    <X className="w-5 h-5 text-white" />
                  ) : (
                    <Send className="w-5 h-5 text-white transition-transform duration-300 group-hover:scale-110 group-hover:translate-x-0.5" />
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
