'use client';
import { useRef, useEffect } from 'react';

interface TouchGesturesOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onPinch?: (factor: number) => void;
  minSwipeDistance?: number;
  maxVerticalDrift?: number;
}

/** Detect page background swipes and avatar-only pinch gestures. */
export function useTouchGestures(options: TouchGesturesOptions = {}) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onPinch,
    minSwipeDistance = 60,
    maxVerticalDrift = 40,
  } = options;
  const handlers = useRef({ onSwipeLeft, onSwipeRight, onPinch });
  const start = useRef<{ x: number; y: number } | null>(null);
  const pinch = useRef<{ distance: number } | null>(null);
  useEffect(() => { handlers.current = { onSwipeLeft, onSwipeRight, onPinch }; }, [onSwipeLeft, onSwipeRight, onPinch]);
  useEffect(() => {
    const element = document.documentElement;
    const onTouchStart = (event: TouchEvent) => {
      const inAvatar = (event.target as Element | null)?.closest?.('[data-avatar-calibration]');
      if (event.touches.length === 2 && inAvatar) {
        start.current = null;
        pinch.current = { distance: Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY) };
      } else if (event.touches.length === 1 && !inAvatar) {
        // One-finger movement inside the avatar viewport is reserved for
        // dragging the character; it must not cycle the page background.
        start.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        pinch.current = null;
      } else if (event.touches.length === 1) {
        start.current = null;
        pinch.current = null;
      } else {
        start.current = null;
        pinch.current = null;
      }
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !pinch.current) return;
      const distance = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY);
      if (distance > 0 && pinch.current.distance > 0) handlers.current.onPinch?.(distance / pinch.current.distance);
      pinch.current = { distance };
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (start.current && event.changedTouches.length > 0 && !pinch.current) {
        const dx = event.changedTouches[0].clientX - start.current.x;
        const dy = event.changedTouches[0].clientY - start.current.y;
        if (Math.abs(dx) > minSwipeDistance && Math.abs(dy) < maxVerticalDrift) {
          if (dx < 0) handlers.current.onSwipeLeft?.();
          else handlers.current.onSwipeRight?.();
        }
      }
      if (event.touches.length < 2) pinch.current = null;
      start.current = null;
    };
    element.addEventListener('touchstart', onTouchStart, { passive: true });
    element.addEventListener('touchmove', onTouchMove, { passive: true });
    element.addEventListener('touchend', onTouchEnd, { passive: true });
    element.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      element.removeEventListener('touchstart', onTouchStart);
      element.removeEventListener('touchmove', onTouchMove);
      element.removeEventListener('touchend', onTouchEnd);
      element.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [minSwipeDistance, maxVerticalDrift]);
}
