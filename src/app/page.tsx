'use client';

import { useState, useEffect } from 'react';
import Live2DAvatar from '@/components/alisha/Live2DAvatar';
import BackgroundLayer from '@/components/alisha/BackgroundLayer';
import VoiceChatButton from '@/components/alisha/VoiceChatButton';
import TextChatButton from '@/components/alisha/TextChatButton';
import SettingsPanel from '@/components/alisha/SettingsPanel';
import StatusBar from '@/components/alisha/StatusBar';
import { Button } from '@/components/ui/button';
import { Settings, Volume2, VolumeX } from 'lucide-react';
import { useAlishaStore } from '@/store/alisha-store';
import { stopSpeaking } from '@/lib/alisha/speech';

/**
 * Hook: useVisualViewportHeight
 *
 * Returns the current visual viewport height in pixels. On mobile browsers
 * the visual viewport shrinks when the on-screen keyboard appears, so UI
 * elements can be positioned relative to the actual visible area.
 *
 * Falls back to window.innerHeight on desktop browsers without visualViewport.
 */
function useVisualViewportHeight(): number {
  const [height, setHeight] = useState<number>(
    typeof window !== 'undefined' ? window.innerHeight : 800
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    const update = () => {
      const h = vv ? vv.height : window.innerHeight;
      setHeight(h);
    };
    update();
    if (vv) {
      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
    }
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      if (vv) {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      }
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return height;
}

export default function Home() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [muted, setMuted] = useState(false);
  const { background, responseLanguage } = useAlishaStore();
  const viewportHeight = useVisualViewportHeight();

  // Stop any speech when unmounting
  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  // If muted, kill ongoing speech
  useEffect(() => {
    if (muted) stopSpeaking();
  }, [muted]);

  // Set document direction based on response language for Arabic
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dir = responseLanguage === 'ar' ? 'rtl' : 'ltr';
  }, [responseLanguage]);

  return (
    <main
      className="relative w-full overflow-hidden flex flex-col"
      style={{ minHeight: `${viewportHeight}px`, height: '100dvh' }}
    >
      {/* Background */}
      <BackgroundLayer background={background} />

      {/* Top bar — fixed height */}
      <header className="relative z-20 flex items-center justify-between px-4 sm:px-6 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-pink-400 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
            A
          </div>
          <div className="flex flex-col">
            <span className="text-base sm:text-lg font-semibold text-white drop-shadow">
              اليشيا
            </span>
            <span className="text-[10px] text-white/70 drop-shadow">
              Live2D · Gemini AI
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMuted((m) => !m)}
            className="text-white hover:bg-white/10"
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? (
              <VolumeX className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            className="text-white hover:bg-white/10"
            aria-label="Open settings"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Avatar area — flex-1 takes remaining space, centers avatar */}
      <section className="relative z-10 flex-1 flex items-center justify-center px-2 min-h-0 overflow-hidden pb-2">
        <div className="relative w-full h-full max-w-[min(88vw,28rem)] max-h-[min(62vh,34rem)] mx-auto flex items-center justify-center">
          <Live2DAvatar
            background={background}
            speaking={speaking && !muted}
            listening={listening}
            thinking={thinking}
          />
        </div>
      </section>

      {/* Bottom controls — fixed height, sits above keyboard */}
      <footer
        className="relative z-20 flex flex-col items-center gap-2 px-4 pb-3 pt-1 shrink-0"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <StatusBar
          speaking={speaking && !muted}
          listening={listening}
          thinking={thinking}
          responseLanguage={responseLanguage}
        />

        <div className="flex items-end gap-4 sm:gap-6">
          <VoiceChatButton
            onSpeakingChange={(s) => {
              if (muted && s) {
                stopSpeaking();
                setSpeaking(false);
              } else {
                setSpeaking(s);
              }
            }}
            onListeningChange={setListening}
            onThinkingChange={setThinking}
          />
          <TextChatButton
            onSpeakingChange={(s) => {
              if (muted && s) {
                stopSpeaking();
                setSpeaking(false);
              } else {
                setSpeaking(s);
              }
            }}
            onThinkingChange={setThinking}
          />
        </div>
      </footer>

      <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
    </main>
  );
}
