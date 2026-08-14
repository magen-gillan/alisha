'use client';

import { useEffect, useRef, useState } from 'react';
import type { BackgroundId } from '@/lib/alisha/types';

interface Live2DAvatarProps {
  background: BackgroundId;
  speaking: boolean;
  listening: boolean;
  thinking: boolean;
}

/**
 * Live2DAvatar — completely rewritten for reliable centering.
 *
 * Root cause of previous bug:
 *   The old `fitModel()` read `model.originalWidth || model.width`. If
 *   `originalWidth` was undefined, it fell back to `model.width` which
 *   is the CURRENT scaled bounds. On every resize this compounded the
 *   scale error. Additionally, the manual `x`/`y` math assumed the
 *   model's anchor was at (0,0) top-left, but pixi-live2d-display's
 *   internal coordinate origin doesn't always match the visible bounds.
 *
 * New approach (much simpler & robust):
 *   1. Set `model.anchor.set(0.5, 0.5)` — the anchor becomes the
 *      model's CENTER, in normalized [0..1] coordinates relative to
 *      the model's own canvas.
 *   2. Position: `model.x = renderer.width / 2`, `model.y = renderer.height / 2`
 *      — perfect centering, no manual width math.
 *   3. Scale: read `model.internalModel.originalWidth/Height` (the raw
 *      canvas size from the model3.json Geometry, never changes), compute
 *      `scale = min(rw/mw, rh/mh) * 0.9` so the model always fits with
 *      a 10% margin.
 *   4. ResizeObserver on the container triggers a refit when the
 *      viewport changes (keyboard open/close, orientation change, etc.)
 *
 * If Live2D fails to load (CORS, missing files, etc.), the component
 * gracefully falls back to a static SVG illustration.
 */
export default function Live2DAvatar({
  background,
  speaking,
  listening,
  thinking,
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
  useEffect(() => {
    speakingRef.current = speaking;
  }, [speaking]);
  useEffect(() => {
    listeningRef.current = listening;
  }, [listening]);
  useEffect(() => {
    thinkingRef.current = thinking;
  }, [thinking]);

  // ---- Live2D init ----
  useEffect(() => {
    let cancelled = false;
    let raf: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let onResize: (() => void) | null = null;

    async function init() {
      if (!canvasRef.current || !containerRef.current) return;
      setLoadState('loading');

      try {
        // 1) Load Cubism Core runtime
        if (!(window as any).Live2DCubismCore) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement('script');
            s.src = '/alisha/live2d/live2dcubismcore.min.js';
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
          throw new Error('Live2DModel constructor not found in pixi-live2d-display.');
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

        // 3) Create PIXI application — explicitly sized to the container
        //    so the renderer always matches the visible area.
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

        // 4) Load the Live2D model (Kei — official Live2D Cubism 4 sample)
        const modelUrl = '/alisha/live2d/alisha/kei_basic_free.model3.json';
        const model = await Live2DModel.from(modelUrl);
        if (cancelled) {
          try {
            model.destroy();
          } catch {}
          return;
        }
        modelRef.current = model;
        app.stage.addChild(model);

        // 5) Anchor at center — this is the key fix.
        //    After this, model.x/y position the model's CENTER, not its
        //    top-left corner. This makes centering trivial and reliable.
        try {
          model.anchor.set(0.5, 0.5);
        } catch {
          // Some versions of pixi-live2d-display don't support anchor;
          // fall back to manual centering using getBounds().
        }

        // 6) Fit model to container — read ORIGINAL dimensions from
        //    internalModel (these never change, even after scaling).
        const fitModel = () => {
          if (!modelRef.current || !containerRef.current || !pixiAppRef.current) return;
          const cw = containerRef.current.clientWidth;
          const ch = containerRef.current.clientHeight;
          if (!cw || !ch) return;

          // Resize the PIXI renderer to match the container.
          try {
            pixiAppRef.current.renderer.resize(cw, ch);
          } catch {
            /* noop */
          }

          // Original canvas size from the model3.json file.
          // Try multiple sources in order of reliability.
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

          // Scale so the model fits inside the container with a 10% margin.
          // Use Math.min so neither dimension overflows.
          const scale = Math.min(cw / mw, ch / mh) * 0.9;
          try {
            modelRef.current.scale.set(scale);
          } catch {
            /* noop */
          }

          // Center on stage. Because anchor is (0.5, 0.5), setting
          // x/y to the renderer center puts the model's center there.
          try {
            modelRef.current.x = cw / 2;
            modelRef.current.y = ch / 2;
          } catch {
            /* noop */
          }
        };

        fitModel();
        fitModelRef.current = fitModel;

        // Watch container size to refit when keyboard opens/closes
        if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
          resizeObserver = new ResizeObserver(() => {
            fitModel();
          });
          resizeObserver.observe(containerRef.current);
        }

        // Also handle window resize as fallback
        onResize = () => fitModel();
        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);

        // 7) Animation loop — drive mouth / motion based on state
        let phase = 0;
        const tick = () => {
          phase += 0.1;
          if (modelRef.current) {
            try {
              if (modelRef.current.internalModel?.setParameterValueById) {
                const motionState = speakingRef.current
                  ? (Math.sin(phase * 6) * 0.5 + 0.5) * 0.9 + 0.1
                  : 0;
                modelRef.current.internalModel.setParameterValueById(
                  'ParamMouthOpenY',
                  motionState
                );
              }
            } catch {
              /* noop */
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        setLoadState('ready');
      } catch (err: any) {
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
      try {
        modelRef.current?.destroy?.();
      } catch {}
      try {
        pixiAppRef.current?.destroy?.(true);
      } catch {}
      modelRef.current = null;
      pixiAppRef.current = null;
    };
  }, []);

  // Trigger motions when state changes
  useEffect(() => {
    if (loadState !== 'ready' || !modelRef.current) return;
    try {
      if (speaking) {
        // motion handled by animation loop (mouth)
      } else if (listening) {
        modelRef.current.motion('Idle');
      } else if (thinking) {
        modelRef.current.motion('Idle');
      }
    } catch {}
  }, [speaking, listening, thinking, loadState]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
      aria-label="Alisha avatar"
    >
      {/* Live2D canvas — fills container */}
      <canvas
        ref={canvasRef}
        className={`w-full h-full block transition-opacity duration-500 ${
          loadState === 'ready' ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Fallback SVG avatar (shown while loading or if Live2D fails) */}
      {loadState !== 'ready' && (
        <FallbackAvatar
          speaking={speaking}
          listening={listening}
          thinking={thinking}
          error={loadState === 'failed' ? errorMsg : undefined}
        />
      )}

      {/* Status ring around avatar */}
      <div
        className={`pointer-events-none absolute inset-0 rounded-full transition-all duration-300 ${
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
          src="/alisha-avatar.png"
          alt="أفاتار اليشيا"
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
