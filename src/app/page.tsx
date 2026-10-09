'use client';

import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import BackgroundLayer from '@/components/alisha/BackgroundLayer';
import VoiceChatButton from '@/components/alisha/VoiceChatButton';
import TextChatButton from '@/components/alisha/TextChatButton';
import SettingsPanel from '@/components/alisha/SettingsPanel';
import StatusBar from '@/components/alisha/StatusBar';
import AlishaErrorBoundary from '@/components/alisha/AlishaErrorBoundary';
import { Button } from '@/components/ui/button';
import { Settings, Loader2 } from 'lucide-react';
import { useAlishaStore } from '@/store/alisha-store';
import { stopSpeaking } from '@/lib/alisha/speech';
import { useTouchGestures } from '@/hooks/use-touch-gestures';
import { nextBackground, prevBackground } from '@/lib/alisha/types';
import ThemeToggle from '@/components/alisha/ThemeToggle';
import type { Emotion } from '@/lib/alisha/emotion';

// Lazy-load Live2DAvatar so pixi.js + pixi-live2d-display (combined ~600KB)
// don't ship in the initial bundle. They're loaded on demand when the
// avatar section actually renders.
const Live2DAvatar = lazy(() => import('@/components/alisha/Live2DAvatar'));

function AvatarFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-fuchsia-400/60" />
    </div>
  );
}

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
  const { background, responseLanguage, avatarId, setBackground, theme, setTheme } = useAlishaStore();
  const viewportHeight = useVisualViewportHeight();

  // Store the setEmotion function from Live2DAvatar so VoiceChatButton /
  // TextChatButton can trigger emotion changes when the AI responds.
  const setEmotionRef = useRef<((emotion: Emotion) => void) | null>(null);

  // Touch gestures: swipe horizontally to cycle backgrounds, pinch to zoom.
  const { pinchScale } = useTouchGestures({
    onSwipeLeft: () => setBackground(prevBackground(background)),
    onSwipeRight: () => setBackground(nextBackground(background)),
  });

  // Apply theme class to <html> so global CSS variables can react.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('theme-light', theme === 'light');
  }, [theme]);

  // Stop any speech when unmounting
  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  // Set document direction based on response language for Arabic
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = responseLanguage;
    document.documentElement.dir = responseLanguage === 'ar' ? 'rtl' : 'ltr';
  }, [responseLanguage]);

  // Global keyboard shortcuts:
  //   Ctrl/Cmd + ,  → open settings (matches most apps)
  //   Ctrl/Cmd + Enter → close settings
  //   1..5 → switch avatar (Kei/Jane/IceGirl/GanYu/Miara)
  //   b    → cycle background
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore typing in inputs/textareas.
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (target?.isContentEditable) return;

      const isMod = e.ctrlKey || e.metaKey;
      // Ctrl/Cmd + , → open settings
      if (isMod && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
        return;
      }
      // Ctrl/Cmd + Enter → close settings
      if (isMod && e.key === 'Enter') {
        e.preventDefault();
        setSettingsOpen(false);
        return;
      }
      // 1..5 → switch avatar (only when settings panel is closed to avoid
      // clashing with native shortcuts when typing keys in the sheet).
      if (!settingsOpen && !isMod && /^[1-5]$/.test(e.key)) {
        const ids = ['kei', 'jane', 'icegirl', 'ganyu', 'miara'] as const;
        const idx = parseInt(e.key, 10) - 1;
        if (idx < ids.length) {
          useAlishaStore.getState().setAvatarId(ids[idx]);
        }
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsOpen]);

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
          <img
            src="/alisha-new-icon.png"
            alt="Alisha"
            className="h-10 w-10 rounded-full border border-white/40 object-cover shadow-lg shadow-fuchsia-900/30"
          />
          <span className="alisha-header-title text-base sm:text-lg font-semibold">
            Alisha
          </span>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle theme={theme} onToggle={setTheme} />
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
        <div
          className="relative w-full h-full max-w-[min(88vw,28rem)] max-h-[min(62vh,34rem)] mx-auto flex items-center justify-center transition-transform duration-200"
          style={{ transform: `scale(${pinchScale})` }}
        >
          <AlishaErrorBoundary label="Avatar">
            <Suspense fallback={<AvatarFallback />}>
              <Live2DAvatar
                background={background}
                speaking={speaking}
                listening={listening}
                thinking={thinking}
                avatarId={avatarId}
                onEmotionReady={(fn) => { setEmotionRef.current = fn; }}
              />
            </Suspense>
          </AlishaErrorBoundary>
          {/* Audio visualization overlay when Alisha is speaking */}
          {speaking && (
            <div className="pointer-events-none absolute inset-x-0 bottom-2 flex items-end justify-center gap-1 h-10 z-20" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <span
                  key={i}
                  className="w-1 bg-fuchsia-400/70 rounded-full animate-eq"
                  style={{
                    height: '30%',
                    animationDelay: `${i * 80}ms`,
                    animationDuration: `${600 + (i % 3) * 120}ms`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Bottom controls — fixed height, sits above keyboard */}
      <footer
        className="relative z-20 flex flex-col items-center gap-2 px-4 pb-3 pt-1 shrink-0"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <StatusBar
          speaking={speaking}
          listening={listening}
          thinking={thinking}
          responseLanguage={responseLanguage}
        />

        <div className="flex items-end gap-4 sm:gap-6">
          <VoiceChatButton
            onSpeakingChange={(s) => {
              setSpeaking(s)
            }}
            onListeningChange={setListening}
            onThinkingChange={setThinking}
            setEmotionRef={setEmotionRef}
          />
          <TextChatButton
            onSpeakingChange={(s) => {
              setSpeaking(s)
            }}
            onThinkingChange={setThinking}
            setEmotionRef={setEmotionRef}
          />
        </div>
      </footer>

      <AlishaErrorBoundary label="Settings">
        <SettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} />
      </AlishaErrorBoundary>
    </main>
  );
}
