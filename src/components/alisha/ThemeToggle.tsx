'use client';

import { Moon, Sun } from 'lucide-react';
import type { AppTheme } from '@/lib/alisha/types';

interface ThemeToggleProps {
  theme: AppTheme;
  onToggle: (next: AppTheme) => void;
  className?: string;
}

/**
 * ThemeToggle — animated sun/moon switch inspired by the popular
 * Uiverse.io "Day/Night" toggle pattern.
 *
 * Visual behaviour:
 *   - Pill-shaped track that slides between sun (left, light) and moon (right, dark)
 *   - The knob smoothly translates + rotates 360deg on toggle
 *   - Stars/sparkles fade in around the moon when in dark mode
 *   - Sun rays scale-up around the sun when in light mode
 *   - Glow shifts colour from amber (light) to indigo (dark)
 *
 * Accessibility:
 *   - role="switch" + aria-checked for screen readers
 *   - keyboard: Space/Enter toggles
 *   - focus-visible ring
 */
export default function ThemeToggle({ theme, onToggle, className = '' }: ThemeToggleProps) {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => onToggle(isDark ? 'light' : 'dark')}
      className={`alisha-theme-toggle group relative inline-flex h-9 w-16 items-center rounded-full transition-colors duration-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-transparent ${
        isDark
          ? 'bg-gradient-to-r from-indigo-900 to-violet-800 shadow-[inset_0_0_8px_rgba(99,102,241,0.6)]'
          : 'bg-gradient-to-r from-sky-300 to-amber-200 shadow-[inset_0_0_8px_rgba(251,191,36,0.6)]'
      } ${className}`}
      title={isDark ? 'الوضع المظلم' : 'الوضع الفاتح'}
    >
      {/* Star sparkles — visible in dark mode */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${
          isDark ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <span className="absolute top-1 left-2 h-0.5 w-0.5 rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.9)]" />
        <span className="absolute top-2 left-5 h-0.5 w-0.5 rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.9)]" />
        <span className="absolute top-1 left-8 h-0.5 w-0.5 rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.9)]" />
        <span className="absolute bottom-1.5 left-3 h-0.5 w-0.5 rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.9)]" />
        <span className="absolute bottom-2 left-7 h-0.5 w-0.5 rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.9)]" />
      </span>

      {/* Sun rays — visible in light mode */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 transition-opacity duration-500 ${
          isDark ? 'opacity-0 scale-50' : 'opacity-100 scale-100'
        }`}
      >
        <Sun className="h-4 w-4 text-amber-500 drop-shadow-[0_0_4px_rgba(251,191,36,0.8)]" />
      </span>

      {/* Knob — slides left/right and rotates */}
      <span
        aria-hidden="true"
        className={`inline-flex h-7 w-7 transform items-center justify-center rounded-full bg-white shadow-lg transition-all duration-500 ease-out ${
          isDark
            ? 'translate-x-8 rotate-[360deg] bg-slate-900'
            : 'translate-x-1 rotate-0 bg-white'
        }`}
      >
        {isDark ? (
          <Moon className="h-4 w-4 text-indigo-300" />
        ) : (
          <Sun className="h-4 w-4 text-amber-500" />
        )}
      </span>
    </button>
  );
}
