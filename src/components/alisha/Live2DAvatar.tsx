'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { BackgroundId, AvatarId } from '@/lib/alisha/types';
import { getAvatarById } from '@/lib/alisha/avatars';
import { useCursorFollow } from '@/hooks/use-cursor-follow';
import { getEmotionParams, blendEmotions, type Emotion } from '@/lib/alisha/emotion';

interface Live2DAvatarProps {
  background: BackgroundId;
  speaking: boolean;
  listening: boolean;
  thinking: boolean;
  avatarId: AvatarId;
  onEmotionReady?: (setEmotion: (emotion: Emotion) => void) => void;
}

/**
 * Live2DAvatar — Cinematic game-presentation mode.
 *
 * Inspired by Mobile Legends: Bang Bang lobby:
 * - Character is large, anchored to bottom of screen
 * - Continuous idle motion (breathing, hair sway)
 * - Real Live2D motion playback (Idle, Tap groups)
 * - Cursor-driven head/eye/body parallax
 * - Emotion-driven facial expressions
 * - Lip-sync during speech
 * - Natural blinking
 * - Particle effects + glow around character
 *
 * Uses key={avatarId} to force full remount on avatar switch.
 */

export default function Live2DAvatar({
  background,
  speaking,
  listening,
  thinking,
  avatarId,
  onEmotionReady,
}: Live2DAvatarProps) {
  return (
    <AvatarInstance
      key={avatarId}
      background={background}
      speaking={speaking}
      listening={listening}
      thinking={thinking}
      avatarId={avatarId}
      onEmotionReady={onEmotionReady}
    />
  );
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

  // State refs for animation loop
  const speakingRef = useRef(speaking);
  const listeningRef = useRef(listening);
  const thinkingRef = useRef(thinking);

  // Cursor follow
  const cursorRef = useCursorFollow();

  // Emotion tracking
  const currentEmotionRef = useRef<Emotion>('neutral');
  const targetEmotionRef = useRef<Emotion>('neutral');
  const emotionBlendRef = useRef(0);

  // Motion system state
  const motionStateRef = useRef<'idle' | 'speaking' | 'listening' | 'thinking' | 'tap'>('idle');
  const lastIdleMotionRef = useRef(0);

  const setEmotion = useCallback((emotion: Emotion) => {
    targetEmotionRef.current = emotion;
    emotionBlendRef.current = 0;
  }, []);

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
        // 1) Load Cubism Core
        if (!(window as any).Live2DCubismCore) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement('script');
            s.src = '/live2d/live2dcubismcore.min.js';
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Failed to load Cubism Core runtime.'));
            document.head.appendChild(s);
          });
        }

        // 2) Dynamic import PIXI + pixi-live2d-display
        const PIXI_MODULE: any = await import('pixi.js');
        const PIXI = PIXI_MODULE.default || PIXI_MODULE;
        const live2dModule: any = await import('pixi-live2d-display/cubism4' as string);
        const Live2DModel = live2dModule.Live2DModel || live2dModule.default?.Live2DModel;

        if (!Live2DModel) throw new Error('Live2DModel constructor not found.');

        const TickerRef = PIXI.Ticker || PIXI_MODULE.Ticker;
        if (Live2DModel.registerTicker && TickerRef) {
          Live2DModel.registerTicker(TickerRef);
        }
        try {
          const ext: any = live2dModule as any;
          if (ext.extensions && PIXI.extensions) {
            PIXI.extensions.add(ext.extensions);
          }
        } catch {}

        if (cancelled) return;

        // 3) Create PIXI application
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

        // 4) Load model with timeout
        const modelUrl = avatar.modelUrl;
        let model: any;
        const loadTimeoutMs = 30_000;
        try {
          model = await Promise.race([
            Live2DModel.from(modelUrl, {
              onError: (err: any) => console.error('[Live2DAvatar] model load error:', err),
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() =>
                reject(new Error(`Model load timed out after ${loadTimeoutMs / 1000}s`)),
                loadTimeoutMs
              )
            ),
          ]);
        } catch (modelErr: any) {
          const msg = String(modelErr?.message || '').toLowerCase();
          if (msg.includes('moc') || msg.includes('version'))
            throw new Error('MOC3 format not supported by bundled Cubism Core.');
          if (msg.includes('network') || msg.includes('timed out'))
            throw new Error('Network error. Check your connection and try again.');
          throw modelErr;
        }

        if (cancelled) { try { model.destroy(); } catch {} return; }
        modelRef.current = model;
        app.stage.addChild(model);

        // 5) Anchor at bottom-center for cinematic presentation
        //    anchor (0.5, 1.0) = bottom center of the model's canvas
        try {
          model.anchor.set(0.5, 0.85);
        } catch {}

        // 6) Cinematic fit — character fills most of the screen,
        //    anchored to the bottom, slightly larger than container
        const fitModel = () => {
          if (!modelRef.current || !containerRef.current || !pixiAppRef.current) return;
          const cw = containerRef.current.clientWidth;
          const ch = containerRef.current.clientHeight;
          if (!cw || !ch) return;

          try { pixiAppRef.current.renderer.resize(cw, ch); } catch {}

          const internal = modelRef.current.internalModel;
          const mw = internal?.originalWidth || modelRef.current.originalWidth || internal?.canvasWidth || 1024;
          const mh = internal?.originalHeight || modelRef.current.originalHeight || internal?.canvasHeight || 1024;

          // Scale to fill height (not width) — character is tall
          // Use 1.0 multiplier for full-screen presence (was 0.9 before)
          const scale = (ch / mh) * 1.0;
          try { modelRef.current.scale.set(scale); } catch {}
          // Position: center horizontally, bottom vertically
          // With anchor (0.5, 0.85), y = ch positions the model's
          // 85% point at the bottom of the screen
          try {
            modelRef.current.x = cw / 2;
            modelRef.current.y = ch * 0.95;
          } catch {}
        };

        fitModel();
        fitModelRef.current = fitModel;

        if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
          resizeObserver = new ResizeObserver(() => fitModel());
          resizeObserver.observe(containerRef.current);
        }
        onResize = () => fitModel();
        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);

        // 7) Start idle motion immediately (if the model has motion groups)
        tryPlayMotion('Idle');

        // 8) Animation loop — cinematic camera + emotion + lip-sync + blink
        let blinkUntil = 0;
        let nextBlink = performance.now() + 2400;
        let mouthValue = 0;
        let mouthTarget = 0;
        let nextMouthChange = 0;
        // Breathing animation
        let breathPhase = 0;
        // Parallax offset for cinematic depth
        let parallaxX = 0;
        let parallaxY = 0;

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

              // ---- Cinematic cursor follow ----
              // Smooth parallax: character moves slightly toward cursor
              const cursor = cursorRef.current;
              const targetParallaxX = cursor.x * 12;
              const targetParallaxY = cursor.y * 6;
              parallaxX += (targetParallaxX - parallaxX) * 0.05;
              parallaxY += (targetParallaxY - parallaxY) * 0.05;

              // Head follows cursor (larger range than before for cinematic feel)
              setParameter('ParamAngleX', cursor.x * 30);
              setParameter('ParamAngleY', -cursor.y * 20);
              setParameter('ParamEyeBallX', cursor.x);
              setParameter('ParamEyeBallY', cursor.y);

              // Body follows head with delay (parallax effect)
              setParameter('ParamBodyAngleX', cursor.x * 10);
              setParameter('ParamBodyAngleY', -cursor.y * 6);

              // ---- Breathing (Idle) ----
              // Continuous subtle breathing — always active
              breathPhase += 0.015;
              const breathValue = Math.sin(breathPhase) * 0.5 + 0.5; // 0..1
              try { setParameter('ParamBreath', breathValue); } catch {}

              // ---- Emotion blending ----
              const targetParams = getEmotionParams(targetEmotionRef.current);
              const currentParams = getEmotionParams(currentEmotionRef.current);
              if (emotionBlendRef.current < 1) {
                emotionBlendRef.current = Math.min(1, emotionBlendRef.current + 0.02);
              }
              const blended = blendEmotions(currentParams, targetParams, emotionBlendRef.current);
              if (emotionBlendRef.current >= 1) {
                currentEmotionRef.current = targetEmotionRef.current;
              }
              if (!speakingRef.current) {
                try { setParameter('ParamMouthForm', blended.mouthForm); } catch {}
                try { setParameter('ParamBrowLY', blended.browAngle); } catch {}
                try { setParameter('ParamBrowRY', blended.browAngle); } catch {}
              }
              const eyeBase = blended.eyeLOpen;

              // ---- Lip-sync ----
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

              // ---- Blinking (suspended during speech) ----
              if (!speakingRef.current && now >= nextBlink) {
                blinkUntil = now + 135;
                nextBlink = now + 2200 + Math.random() * 2400;
              }
              const blink = now < blinkUntil ? 0.05 : 1;
              const eyeL = speakingRef.current ? Math.max(blink, eyeBase * 0.9) : blink * eyeBase;
              const eyeR = speakingRef.current ? Math.max(blink, eyeBase * 0.9) : blink * eyeBase;
              setParameter('ParamEyeLOpen', eyeL);
              setParameter('ParamEyeROpen', eyeR);

              // ---- Auto idle motion trigger (every 8-15s) ----
              // If idle for too long, play a random idle motion
              if (!speakingRef.current && !listeningRef.current && !thinkingRef.current) {
                if (now - lastIdleMotionRef.current > 8000 + Math.random() * 7000) {
                  lastIdleMotionRef.current = now;
                  tryPlayMotion('Idle');
                }
              }
            } catch {}
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        // Helper: try to play a motion from a named group
        function tryPlayMotion(group: string, index: number = 0, priority: number = 2) {
          if (!modelRef.current) return;
          try {
            // Check if the model has this motion group
            const settings = modelRef.current.internalModel?.settings;
            const motionGroups = settings?.motions || {};
            if (motionGroups[group] && motionGroups[group].length > 0) {
              const idx = index < motionGroups[group].length ? index : 0;
              modelRef.current.motion(group, idx, priority);
              if (process.env.NODE_ENV !== 'production') {
                console.log(`[Live2D] Playing motion: ${group}[${idx}]`);
              }
              return;
            }
            // For models with unnamed motion group (like Kei)
            const unnamed = motionGroups[''] || [];
            if (unnamed.length > 0 && group === 'Idle') {
              const randomIdx = Math.floor(Math.random() * unnamed.length);
              modelRef.current.motion('', randomIdx, priority);
              if (process.env.NODE_ENV !== 'production') {
                console.log(`[Live2D] Playing unnamed motion[${randomIdx}]`);
              }
            }
          } catch {
            /* model doesn't support motions — use parameter animation only */
          }
        }

        // Expose motion trigger for external use
        (modelRef.current as any)._alishaPlayMotion = tryPlayMotion;

        setLoadState('ready');
        if (onEmotionReady) onEmotionReady(setEmotion);
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
      if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
      if (onResize) {
        window.removeEventListener('resize', onResize);
        window.removeEventListener('orientationchange', onResize);
      }
      try { modelRef.current?.destroy?.(); } catch {}
      try { pixiAppRef.current?.destroy?.(true); } catch {}
      modelRef.current = null;
      pixiAppRef.current = null;
      fitModelRef.current = null;
    };
  }, [avatarId]);

  // ---- State-based motion triggers ----
  useEffect(() => {
    if (loadState !== 'ready' || !modelRef.current) return;
    const model = modelRef.current as any;
    if (!model._alishaPlayMotion) return;

    if (speaking) {
      // During speech, don't override with idle motions
      motionStateRef.current = 'speaking';
    } else if (listening) {
      model._alishaPlayMotion('Idle', 0, 2);
      motionStateRef.current = 'listening';
    } else if (thinking) {
      model._alishaPlayMotion('Idle', 0, 2);
      motionStateRef.current = 'thinking';
    } else {
      // Back to idle
      if (motionStateRef.current !== 'idle') {
        model._alishaPlayMotion('Idle', 0, 2);
      }
      motionStateRef.current = 'idle';
      lastIdleMotionRef.current = performance.now();
    }
  }, [speaking, listening, thinking, loadState]);

  /**
   * Tap handler — plays Tap motion (or expression) on click
   */
  const handleTap = () => {
    if (loadState !== 'ready' || !modelRef.current) return;
    const model = modelRef.current as any;
    try {
      // Try Tap motion group first
      if (model._alishaPlayMotion) {
        model._alishaPlayMotion('Tap', 0, 3);
      }
      // Also try expressions
      const tryExpression = model.expression;
      if (typeof tryExpression === 'function') {
        const n = model.internalModel?.settings?.expressions?.length || 0;
        if (n > 0 && Math.random() < 0.5) {
          tryExpression(Math.floor(Math.random() * n));
        }
      }
    } catch {}
  };

  return (
    <div
      ref={containerRef}
      onClick={handleTap}
      className="relative w-full h-full flex items-end justify-center overflow-hidden cursor-pointer"
      aria-label="Alisha avatar"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTap(); }
      }}
    >
      {/* Glow behind character */}
      <div
        className={`pointer-events-none absolute inset-0 transition-all duration-500 ${
          speaking
            ? 'shadow-[inset_0_-20px_80px_20px_rgba(168,85,247,0.3)]'
            : listening
            ? 'shadow-[inset_0_-20px_80px_20px_rgba(236,72,153,0.25)]'
            : thinking
            ? 'shadow-[inset_0_-20px_80px_20px_rgba(59,130,246,0.25)]'
            : 'shadow-[inset_0_-20px_60px_15px_rgba(168,85,247,0.12)]'
        }`}
      />

      {/* Particle layer — floating bokeh dots */}
      {loadState === 'ready' && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="absolute rounded-full animate-float-particle"
              style={{
                left: `${(i * 8.3 + 5) % 100}%`,
                top: `${(i * 17 + 10) % 80}%`,
                width: `${4 + (i % 4) * 3}px`,
                height: `${4 + (i % 4) * 3}px`,
                background: i % 3 === 0
                  ? 'rgba(244,114,182,0.3)'
                  : i % 3 === 1
                  ? 'rgba(139,92,246,0.3)'
                  : 'rgba(34,211,238,0.2)',
                animationDelay: `${i * 0.7}s`,
                animationDuration: `${8 + (i % 5) * 2}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Canvas — fills container, anchored to bottom */}
      <canvas
        ref={canvasRef}
        className={`w-full h-full block transition-opacity duration-700 ${
          loadState === 'ready' ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Fallback */}
      {loadState !== 'ready' && (
        <FallbackAvatar
          speaking={speaking}
          listening={listening}
          thinking={thinking}
          error={loadState === 'failed' ? errorMsg : undefined}
        />
      )}

      {/* Status ring — cinematic glow border when active */}
      <div
        className={`pointer-events-none absolute inset-0 rounded-3xl transition-all duration-500 ${
          speaking || listening || thinking ? 'alisha-glow-card is-active' : ''
        } ${
          speaking
            ? 'shadow-[0_0_80px_20px_rgba(168,85,247,0.35)]'
            : listening
            ? 'shadow-[0_0_80px_20px_rgba(236,72,153,0.35)]'
            : thinking
            ? 'shadow-[0_0_80px_20px_rgba(59,130,246,0.35)]'
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
    <div className="absolute inset-0 flex flex-col items-center justify-end gap-3 text-center pb-8">
      <div
        className={`relative w-48 h-48 sm:w-64 sm:h-64 rounded-full overflow-hidden bg-gradient-to-br from-pink-200 via-purple-200 to-indigo-200 shadow-2xl ${
          speaking ? 'animate-pulse' : listening ? 'animate-bounce' : thinking ? 'animate-spin-slow' : 'animate-float'
        }`}
      >
        <img
          src="/alisha-new-icon.png"
          alt="Alisha"
          className="h-full w-full object-cover object-top"
        />
      </div>
      <p className="text-xs text-muted-foreground max-w-xs">
        {error ? `Live2D unavailable. (${error})` : 'Loading Alisha…'}
      </p>
    </div>
  );
}
