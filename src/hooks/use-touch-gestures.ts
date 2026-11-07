'use client';
import { useRef, useEffect } from 'react';

interface TouchGesturesOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  minSwipeDistance?: number;
  maxVerticalDrift?: number;
}

/** Detect page background swipes; avatar calibration is fixed and has no gestures. */
export function useTouchGestures(options: TouchGesturesOptions = {}) {
  const {
    onSwipeLeft,
    onSwipeRight,
    minSwipeDistance = 60,
    maxVerticalDrift = 40,
  } = options;
  const handlers = useRef({ onSwipeLeft, onSwipeRight });
  const start = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => { handlers.current = { onSwipeLeft, onSwipeRight }; }, [onSwipeLeft, onSwipeRight]);
  useEffect(() => {
    const element = document.documentElement;
    const onTouchStart = (event: TouchEvent) => {
      const inAvatar = (event.target as Element | null)?.closest?.('[data-avatar-canvas]');
      if (event.touches.length === 1 && !inAvatar) {
        start.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      } else {
        // Gestures inside the avatar cannot modify its fixed calibration.
        start.current = null;
      }
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (start.current && event.changedTouches.length > 0) {
        const dx = event.changedTouches[0].clientX - start.current.x;
        const dy = event.changedTouches[0].clientY - start.current.y;
        if (Math.abs(dx) > minSwipeDistance && Math.abs(dy) < maxVerticalDrift) {
          if (dx < 0) handlers.current.onSwipeLeft?.();
          else handlers.current.onSwipeRight?.();
        }
      }
      start.current = null;
    };
    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchend', onTouchEnd, { passive: true });
    element.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchend', onTouchEnd);
      element.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [minSwipeDistance, maxVerticalDrift]);
}
