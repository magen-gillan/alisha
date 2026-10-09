'use client';

import { useEffect, useRef, useState } from 'react';
import type { BackgroundId, AvatarId } from '@/lib/alisha/types';
import { getAvatarById } from '@/lib/alisha/avatars';
import { useCursorFollow } from '@/hooks/use-cursor-follow';
import { getEmotionParams, blendEmotions, type Emotion, type EmotionParams } from '@/lib/alisha/emotion';

interface Live2DAvatarProps {
  background: BackgroundId;
  speaking: boolean;
  listening: boolean;
  thinking: boolean;
  avatarId: AvatarId;
  /** Called when the avatar is ready; receives a setEmotion function */
  onEmotionReady?: (setEmotion: (emotion: Emotion) => void) => void;
}

/**
 * Live2DAvatar — supports runtime avatar switching.
 *
 * Key implementation notes:
 *
 * 1. **Canvas lifecycle**: Each avatar switch creates a FRESH <canvas>
 *    element via React's `key` prop. This avoids the "canvas already in
 *    use" error that occurs when PIXI tries to attach a new Application
 *    to a canvas that was previously bound to a destroyed app.
 *
 * 2. **Cleanup ordering**: When avatarId changes, the cleanup function
 *    runs in this exact order:
 *      a. Set `cancelled = true` (so async init bails out)
 *      b. Cancel requestAnimationFrame loop
 *      c. Disconnect ResizeObserver
 *      d. Remove window listeners
 *      e. Destroy the Live2D model (releases textures, mesh data)
 *      f. Destroy the PIXI Application (releases WebGL context)
 *      g. Null out refs
 *
 * 3. **MOC3 version compatibility**: pixi-live2d-display@0.4.0 ships with
 *    Cubism Core from 2019, which only supports MOC3 versions 1-4. Models
 *    exported with Cubism Editor 5.0+ have MOC3 version 5 and will fail
 *    to load with a "MOC3 version mismatch" error. The catch block falls
 *    back to a static image so the UI stays usable.
 *
 * 4. **WebGL context leak prevention**: PIXI's `destroy(true)` also
 *    destroys the canvas. We pass `true` to ensure the WebGL context is
 *    released, otherwise the browser caps out at ~16 contexts.
 */

interface InitState {
  app: any;
  model: any;
  raf: number | null;
  resizeObserver: ResizeObserver | null;
  onResize: (() => void) | null;
}

export default function Live2DAvatar({
  background,
  speaking,
  listening,
  thinking,
  avatarId,
  onEmotionReady,
}: Live2DAvatarProps) {
  // Use a `key` that changes with avatarId so React fully unmounts + remounts
  // the entire canvas subtree. This is the SIMPLEST and most reliable way to
  // guarantee a fresh canvas + fresh PIXI Application on every switch.
  // (PIXI throws "Canvas already in use" if you reuse a canvas that was
  // bound to a previously-destroyed Application — even after destroy(true).)
  return <AvatarInstance key={avatarId} background={background} speaking={speaking} listening={listening} thinking={thinking} avatarId={avatarId} onEmotionReady={onEmotionReady} />;
}

function AvatarInstance({
  background,
  speaking,
  listening,
  thinking,
  avatarId,
  onEmotionReady,
}: Live2DAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pixiAppRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const fitModelRef = useRef<(() => void) | null>(null);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Track speaking state in a ref so the animation loop always sees latest
  const speakingRef = useRef(speaking);
  const listeningRef = useRef(listening);
  const thinkingRef = useRef(thinking);

  // Cursor follow — Digital-human-live2d inspired
  const cursorRef = useCursorFollow();

  // Emotion tracking — Prometheus-avatar inspired
  const currentEmotionRef = useRef<Emotion>('neutral');
  const targetEmotionRef = useRef<Emotion>('neutral');
  const emotionBlendRef = useRef(0); // 0..1 transition progress

  // Allow parent to set the emotion (e.g. after AI response)
  const setEmotion = (emotion: Emotion) => {
    targetEmotionRef.current = emotion;
    emotionBlendRef.current = 0; // restart transition
  };

  useEffect(() => { speakingRef.current = speaking; }, [speaking]);
  useEffect(() => { listeningRef.current = listening; }, [listening]);
  useEffect(() => { thinkingRef.current = thinking; }, [thinking]);

  // ---- Live2D init ----
  useEffect(() => {
    const avatar = getAvatarById(avatarId);
    let cancelled = false;
    let raf: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let onResize: (() => void) | null = null;

    async function init() {
      if (!canvasRef.current || !containerRef.current) return;
      setLoadState('loading');
      setErrorMsg('');

      try {
        // 1) Load Cubism Core runtime (only once globally)
        if (!(window as any).Live2DCubismCore) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement('script');
            s.src = '/live2d/live2dcubismcore.min.js';
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Failed to load Cubism Core runtime.'));
            document.head.appendChild(s);
          });
        }

        // 2) Dynamic import PIXI + pixi-live2d-display (avoid SSR).
        const PIXI_MODULE: any = await import('pixi.js');
        const PIXI = PIXI_MODULE.default || PIXI_MODULE;
        const live2dModule: any = await import(
          'pixi-live2d-display/cubism4' as string
        );
        const Live2DModel =
          live2dModule.Live2DModel || live2dModule.default?.Live2DModel;

        if (!Live2DModel) {
          throw new Error('Live2DModel constructor not found.');
        }

        const TickerRef = PIXI.Ticker || PIXI_MODULE.Ticker;
        if (Live2DModel.registerTicker && TickerRef) {
          Live2DModel.registerTicker(TickerRef);
        }
        try {
          const ext: any = live2dModule as any;
          if (ext.extensions && PIXI.extensions) {
            PIXI.extensions.add(ext.extensions);
          }
        } catch {
          /* noop */
        }

        if (cancelled) return;

        // 3) Create PIXI application with a FRESH canvas (we rely on the
        //    parent `key={avatarId}` to give us a new <canvas> element
        //    each time, so canvasRef.current is always pristine).
        const cw0 = containerRef.current.clientWidth || 512;
        const ch0 = containerRef.current.clientHeight || 512;
        const app = new PIXI.Application({
          view: canvasRef.current,
          autoStart: true,
          backgroundAlpha: 0,
          antialias: true,
          width: cw0,
          height: ch0,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          autoDensity: true,
        });
        pixiAppRef.current = app;

        // 4) Load the Live2D model.
        //    Some models are large (Jane's texture is 6MB) so we set a long
        //    timeout via AbortController. pixi-live2d-display doesn't expose
        //    a timeout option, but we wrap it with Promise.race to bail out
        //    after 30s.
        const modelUrl = avatar.modelUrl;
        let model: any;
        const loadTimeoutMs = 30_000;
        try {
          const loadPromise = Live2DModel.from(modelUrl, {
            onError: (err: any) => {
              console.error('[Live2DAvatar] model load error:', err);
            },
          });
          // Race against a timeout — if loading takes too long, throw a
          // clearer error than the default "Network error".
          model = await Promise.race([
            loadPromise,
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error(`Model load timed out after ${loadTimeoutMs / 1000}s — check your network connection.`)),
                loadTimeoutMs
              )
            ),
          ]);
        } catch (modelErr: any) {
          const msg = String(modelErr?.message || '').toLowerCase();
          if (msg.includes('moc') || msg.includes('version') || msg.includes('inconsistent')) {
            throw new Error(
              'This avatar uses a MOC3 format that the bundled Cubism Core cannot read.'
            );
          }
          if (msg.includes('network') || msg.includes('timed out') || msg.includes('timeout')) {
            throw new Error(
              `Network error loading avatar. The model files are large (up to 6MB). ` +
              `Please check your connection and try again.`
            );
          }
          throw modelErr;
        }

        if (cancelled) {
          try { model.destroy(); } catch {}
          return;
        }
        modelRef.current = model;
        app.stage.addChild(model);

        // 5) Anchor at center
        try {
          model.anchor.set(0.5, 0.5);
        } catch {
          // Some versions don't support anchor — fall back to manual centering.
        }

        // 6) Fit model to container
        const fitModel = () => {
          if (!modelRef.current || !containerRef.current || !pixiAppRef.current) return;
          const cw = containerRef.current.clientWidth;
          const ch = containerRef.current.clientHeight;
          if (!cw || !ch) return;

          try {
            pixiAppRef.current.renderer.resize(cw, ch);
          } catch {
            /* noop */
          }

          const internal = modelRef.current.internalModel;
          const mw =
            internal?.originalWidth ||
            modelRef.current.originalWidth ||
            internal?.canvasWidth ||
            modelRef.current.width ||
            1024;
          const mh =
            internal?.originalHeight ||
            modelRef.current.originalHeight ||
            internal?.canvasHeight ||
            modelRef.current.height ||
            1024;

          const scale = Math.min(cw / mw, ch / mh) * 0.9;
          try { modelRef.current.scale.set(scale); } catch {}
          try {
            modelRef.current.x = cw / 2;
            modelRef.current.y = ch / 2;
          } catch {}
        };

        fitModel();
        fitModelRef.current = fitModel;

        if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
          resizeObserver = new ResizeObserver(() => { fitModel(); });
          resizeObserver.observe(containerRef.current);
        }

        onResize = () => fitModel();
        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);

        // 7) Animation loop — drive mouth / motion based on state
        let blinkUntil = 0;
        let nextBlink = performance.now() + 2400;
        let mouthValue = 0;
        let mouthTarget = 0;
        let nextMouthChange = 0;
        const tick = (now = performance.now()) => {
          if (modelRef.current) {
            try {
              const internal = modelRef.current.internalModel;
              const core = internal?.coreModel;
              const setParameter = (id: string, value: number) => {
                if (typeof internal?.setParameterValueById === 'function') {
                  internal.setParameterValueById(id, value);
                } else if (typeof core?.setParameterValueById === 'function') {
                  core.setParameterValueById(id, value);
                }
              };

              // ---- Cursor follow (Digital-human-live2d inspired) ----
              // Avatar head and eyes track the mouse position.
              const cursor = cursorRef.current;
              setParameter('ParamAngleX', cursor.x * 30);   // head yaw: -30..30
              setParameter('ParamAngleY', -cursor.y * 20);  // head pitch: -20..20
              setParameter('ParamEyeBallX', cursor.x);       // pupil: -1..1
              setParameter('ParamEyeBallY', cursor.y);       // pupil: -1..1

              // ---- Emotion blending (Prometheus-avatar inspired) ----
              // Smoothly transition from current emotion to target emotion.
              const targetParams = getEmotionParams(targetEmotionRef.current);
              const currentParams = getEmotionParams(currentEmotionRef.current);
              if (emotionBlendRef.current < 1) {
                emotionBlendRef.current = Math.min(1, emotionBlendRef.current + 0.02);
              }
              const blended = blendEmotions(currentParams, targetParams, emotionBlendRef.current);
              if (emotionBlendRef.current >= 1) {
                currentEmotionRef.current = targetEmotionRef.current;
              }
              // Apply emotion params (only when not speaking — mouth is driven
              // by lip-sync during speech)
              if (!speakingRef.current) {
                setParameter('ParamMouthForm', blended.mouthForm);
              }
              // Eye openness influenced by emotion (but blinking takes priority)
              const eyeBase = blended.eyeLOpen;

              // ---- Lip-sync (mouth animation during speech) ----
              if (speakingRef.current) {
                if (now >= nextMouthChange) {
                  mouthTarget = Math.random() < 0.22 ? 0.04 : 0.14 + Math.random() * 0.68;
                  nextMouthChange = now + 90 + Math.random() * 130;
                }
              } else {
                mouthTarget = 0;
                nextMouthChange = now + 260;
              }
              mouthValue += (mouthTarget - mouthValue) * (speakingRef.current ? 0.16 : 0.24);
              setParameter('ParamMouthOpenY', Math.max(0, Math.min(1, mouthValue)));

              // ---- Blinking ----
              if (!speakingRef.current && now >= nextBlink) {
                blinkUntil = now + 135;
                nextBlink = now + 2200 + Math.random() * 2400;
              }
              const blink = now < blinkUntil ? 0.05 : 1;
              // Blend blink with emotion-based eye openness
              const eyeL = speakingRef.current ? Math.max(blink, eyeBase * 0.9) : blink * eyeBase;
              const eyeR = speakingRef.current ? Math.max(blink, eyeBase * 0.9) : blink * eyeBase;
              setParameter('ParamEyeLOpen', eyeL);
              setParameter('ParamEyeROpen', eyeR);

              // ---- Body angle follows head slightly ----
              setParameter('ParamBodyAngleX', cursor.x * 8);
              setParameter('ParamBodyAngleY', -cursor.y * 5);
            } catch {
              /* noop */
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        setLoadState('ready');
        // Expose setEmotion to parent so it can trigger emotion changes
        // when the AI response is received.
        if (onEmotionReady) {
          onEmotionReady(setEmotion);
        }
      } catch (err: any) {
        if (cancelled) return;
        console.error('[Live2DAvatar] init failed:', err);
        setErrorMsg(err?.message || 'Unknown error');
        setLoadState('failed');
      }
    }

    init();

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (onResize) {
        window.removeEventListener('resize', onResize);
        window.removeEventListener('orientationchange', onResize);
      }
      // Destroy model FIRST, then the app — this releases textures
      // that the renderer holds, avoiding WebGL context leaks.
      try { modelRef.current?.destroy?.(); } catch {}
      try { pixiAppRef.current?.destroy?.(true); } catch {}
      modelRef.current = null;
      pixiAppRef.current = null;
      fitModelRef.current = null;
    };
  }, [avatarId]);

  /**
   * Tap the avatar to trigger a random expression (if available).
   */
  const handleTap = () => {
    if (loadState !== 'ready' || !modelRef.current) return;
    try {
      const internal = modelRef.current.internalModel;
      const tryExpression = (modelRef.current as any).expression;
      if (typeof tryExpression === 'function') {
        const n = internal?.settings?.expressions?.length || 0;
        if (n > 0) {
          tryExpression(Math.floor(Math.random() * n));
          return;
        }
      }
      modelRef.current.motion('TapBody');
    } catch {
      /* noop */
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleTap}
      className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-pointer"
      aria-label="Alisha avatar"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleTap();
        }
      }}
    >
      <canvas
        ref={canvasRef}
        className={`w-full h-full block transition-opacity duration-500 ${
          loadState === 'ready' ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {loadState !== 'ready' && (
        <FallbackAvatar
          speaking={speaking}
          listening={listening}
          thinking={thinking}
          error={loadState === 'failed' ? errorMsg : undefined}
        />
      )}

      <div
        className={`pointer-events-none absolute inset-0 rounded-full transition-all duration-300 ${
          speaking || listening || thinking ? 'alisha-glow-card is-active' : ''
        } ${
          speaking
            ? 'shadow-[0_0_60px_15px_rgba(168,85,247,0.45)]'
            : listening
            ? 'shadow-[0_0_60px_15px_rgba(236,72,153,0.45)]'
            : thinking
            ? 'shadow-[0_0_60px_15px_rgba(59,130,246,0.45)]'
            : ''
        }`}
      />
    </div>
  );
}

// ---------------- Fallback Avatar ----------------

function FallbackAvatar({
  speaking,
  listening,
  thinking,
  error,
}: {
  speaking: boolean;
  listening: boolean;
  thinking: boolean;
  error?: string;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
      <div
        className={`relative w-40 h-40 sm:w-52 sm:h-52 rounded-full overflow-hidden bg-gradient-to-br from-pink-200 via-purple-200 to-indigo-200 shadow-2xl ${
          speaking
            ? 'animate-pulse'
            : listening
            ? 'animate-bounce'
            : thinking
            ? 'animate-spin-slow'
            : 'animate-float'
        }`}
        style={{ animationDuration: thinking ? '3s' : undefined }}
      >
        <img
          src="/alisha-new-icon.png"
          alt="Alisha"
          className="h-full w-full object-cover object-top"
        />
      </div>
      <p className="text-xs text-muted-foreground max-w-xs">
        {error
          ? `Live2D unavailable — using Alisha image avatar. (${error})`
          : 'Loading Alisha avatar…'}
      </p>
    </div>
  );
}
