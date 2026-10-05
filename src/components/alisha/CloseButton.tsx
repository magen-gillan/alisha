'use client';

import { X } from 'lucide-react';

interface CloseButtonProps {
  onClick: () => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * CloseButton — premium animated close button inspired by Uiverse
 * "neon close" patterns.
 *
 * Visual behaviour:
 *   - Red circular base with a soft outer glow
 *   - On hover: rotates 90deg, glow intensifies, X scales up
 *   - On press: scales down slightly (tactile feedback)
 *   - Focus-visible ring for keyboard users
 *
 * The red/glow combo makes the button immediately recognizable as a
 * destructive / dismissive action.
 */
export default function CloseButton({
  onClick,
  className = '',
  ariaLabel = 'Close',
}: CloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={`alisha-close-btn group relative inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-900/40 transition-all duration-300 hover:rotate-90 hover:bg-red-500 hover:shadow-red-500/60 hover:shadow-[0_0_25px_rgba(239,68,68,0.7)] active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${className}`}
    >
      {/* Pulsing ring on hover */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full border-2 border-red-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:scale-110"
      />
      <X
        className="h-5 w-5 transition-transform duration-300 group-hover:scale-110"
        strokeWidth={3}
      />
    </button>
  );
}
