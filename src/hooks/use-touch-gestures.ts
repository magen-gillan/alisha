'use client';

import { useRef, useEffect, useState } from 'react';

/**
 * Lightweight touch-gesture hook for the avatar area.
 *
 * Supports:
 *   - Horizontal swipe → calls onSwipeLeft / onSwipeRight (used to cycle
 *     backgrounds)
 *   - Pinch (2-finger) → returns a scale 0.5..2.5 that the caller can apply
 *     to the avatar container
 *
 * Designed to NOT interfere with single-tap (handled by the avatar's own
 * onClick) or scrolling on touchpads — we only act when exactly 2 fingers
 * are down (pinch) or when a single finger swipes more than 60px
 * horizontally with very little vertical drift.
 */

interface TouchGesturesOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  minSwipeDistance?: number; // px
  maxVerticalDrift?: number; // px
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
  const [pinchScale, setPinchScale] = useState(1);

  // Track two-finger pinch distance.
  const initialPinchDistance = useRef<number | null>(null);
  const initialScale = useRef(1);

  useEffect(() => {
    const el = document.documentElement; // attach to whole doc so swipe works anywhere

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        startX.current = e.touches[0].clientX;
        startY.current = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDistance.current = Math.hypot(dx, dy);
        initialScale.current = pinchScale;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialPinchDistance.current != null) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const ratio = dist / initialPinchDistance.current;
        const next = Math.max(0.5, Math.min(2.5, initialScale.current * ratio));
        setPinchScale(next);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (startX.current != null && startY.current != null && e.changedTouches.length > 0) {
        const dx = e.changedTouches[0].clientX - startX.current;
        const dy = e.changedTouches[0].clientY - startY.current;
        if (Math.abs(dx) > minSwipeDistance && Math.abs(dy) < maxVerticalDrift) {
          if (dx < 0) onSwipeLeft?.();
          else onSwipeRight?.();
        }
      }
      // Reset pinch tracking when both fingers are lifted.
      if (e.touches.length === 0) {
        initialPinchDistance.current = null;
      }
      startX.current = null;
      startY.current = null;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [onSwipeLeft, onSwipeRight, minSwipeDistance, maxVerticalDrift, pinchScale]);

  const resetPinch = () => setPinchScale(1);

  return { pinchScale, resetPinch };
}
