'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Keyboard, Loader2, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAlishaStore } from '@/store/alisha-store';
import {
  isTTSSupported,
  speak,
  loadVoices,
} from '@/lib/alisha/speech';
import { detectLanguage } from '@/lib/alisha/language';
import { chatWithGemini } from '@/lib/alisha/gemini-client';

interface TextChatButtonProps {
  onSpeakingChange: (speaking: boolean) => void;
  onThinkingChange: (thinking: boolean) => void;
}

export default function TextChatButton({
  onSpeakingChange,
  onThinkingChange,
}: TextChatButtonProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
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
    setInput('');
    setThinking(true);
    addMessage({ role: 'user', text, lang: detectLanguage(text) });
    onThinkingChange(true);

    try {
      const detected = detectLanguage(text);
      console.log(`[TextChat] input="${text}" detected=${detected} → ${responseLanguage}`);

      const chat = await chatWithGemini({
        userInput: text,
        detectedLanguage: detected,
        responseLanguage,
        model,
        history: historyRef.current,
        permanentMemory,
        signal: controller.signal,
      });

      if (requestId !== requestIdRef.current) return;

      // Add only the model response; the user message was saved before the request.
      addMessage({ role: 'model', text: chat.text, lang: responseLanguage });

      setThinking(false);
      onThinkingChange(false);
      onSpeakingChange(true);

      if (!isTTSSupported()) {
        toast.error('Text-to-speech is not supported in this browser.');
        onSpeakingChange(false);
        return;
      }

      speak({
        text: chat.text,
        language: responseLanguage,
        voiceLanguage,
        voiceURI,
        rate: speechRate,
        pitch: speechPitch,
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
      console.error('[TextChat] Gemini error:', err);
      toast.error(err?.message || 'Failed to get a response from Gemini.');
      setThinking(false);
      onThinkingChange(false);
      onSpeakingChange(false);
    } finally {
      if (requestId === requestIdRef.current) abortRef.current = null;
    }
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
      <Button
        type="button"
        onClick={() => setOpen((o) => !o)}
        size="lg"
        className={`rounded-full w-16 h-16 sm:w-20 sm:h-20 shadow-xl transition-all duration-300 ${
          open
            ? 'bg-rose-500 hover:bg-rose-600'
            : 'bg-gradient-to-br from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700'
        }`}
        aria-label={open ? 'Close text input' : 'Type a message'}
      >
        {open ? (
          <X className="w-7 h-7 text-white" />
        ) : (
          <Keyboard className="w-7 h-7 text-white" />
        )}
      </Button>

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
                placeholder="اكتب أي شيء… (أي لغة)"
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
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!input.trim() || thinking}
                size="icon"
                className="rounded-full w-11 h-11 bg-gradient-to-br from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 shrink-0"
                aria-label="Send"
              >
                {thinking ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Send className="w-5 h-5 text-white" />
                )}
              </Button>
            </div>
            <div className="flex items-center justify-between mt-1 px-1">
              <span className="text-[10px] text-white/40">
                Enter للإرسال · Shift+Enter لسطر جديد · Esc للإغلاق
              </span>
              <span className="text-[10px] text-white/40">
                {input.length} حرف
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
