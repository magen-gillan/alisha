'use client';

import { useRef, useEffect } from 'react';

/** Horizontal swipe detection for cycling backgrounds. Avatar size remains fixed. */
interface TouchGesturesOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  minSwipeDistance?: number;
  maxVerticalDrift?: number;
}

export function useTouchGestures(options: TouchGesturesOptions = {}) {
  const {
    onSwipeLeft,
    onSwipeRight,
    minSwipeDistance = 60,
    maxVerticalDrift = 40,
  } = options;

  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const element = document.documentElement;
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        startX.current = event.touches[0].clientX;
        startY.current = event.touches[0].clientY;
      } else {
        startX.current = null;
        startY.current = null;
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (startX.current !== null && startY.current !== null && event.changedTouches.length > 0) {
        const dx = event.changedTouches[0].clientX - startX.current;
        const dy = event.changedTouches[0].clientY - startY.current;
        if (Math.abs(dx) > minSwipeDistance && Math.abs(dy) < maxVerticalDrift) {
          if (dx < 0) onSwipeLeft?.();
          else onSwipeRight?.();
        }
      }
      startX.current = null;
      startY.current = null;
    };

    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchend', onTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, minSwipeDistance, maxVerticalDrift]);
}
