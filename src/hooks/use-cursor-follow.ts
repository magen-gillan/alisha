'use client';

import { useEffect, useRef } from 'react';

/**
 * Cursor follow hook — tracks mouse/touch position so the Live2D
 * avatar can turn its head and shift its eyes toward the cursor.
 *
 * Inspired by Digital-human-live2d's "Cursor Follow" feature.
 *
 * The hook returns a ref that always contains the latest normalized
 * cursor position: { x: -1..1, y: -1..1 } where (0,0) is center.
 *
 * Usage in the avatar animation loop:
 *   const cursor = cursorRef.current;
 *   setParameter('ParamAngleX', cursor.x * 30);  // head yaw
 *   setParameter('ParamAngleY', -cursor.y * 20);  // head pitch
 *   setParameter('ParamEyeBallX', cursor.x);      // pupil horizontal
 *   setParameter('ParamEyeBallY', cursor.y);      // pupil vertical
 */

export interface CursorPosition {
  /** -1 (left) to 1 (right), 0 = center */
  x: number;
  /** -1 (up) to 1 (down), 0 = center */
  y: number;
}

export function useCursorFollow(): React.MutableRefObject<CursorPosition> {
  const cursorRef = useRef<CursorPosition>({ x: 0, y: 0 });

  useEffect(() => {
    const update = (clientX: number, clientY: number) => {
      // Normalize to -1..1 relative to viewport center
      const x = (clientX / window.innerWidth) * 2 - 1;
      const y = (clientY / window.innerHeight) * 2 - 1;
      cursorRef.current = { x, y };
    };

    const onMouseMove = (e: MouseEvent) => update(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        update(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  return cursorRef;
}
