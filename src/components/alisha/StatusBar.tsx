'use client';

interface StatusBarProps {
  speaking: boolean;
  listening: boolean;
  thinking: boolean;
  responseLanguage: string;
}

/**
 * StatusBar — minimal, silent by default.
 *
 * The bar renders NOTHING when the avatar is idle, so the main screen stays
 * clean (just the avatar + the Alisha header + the action buttons). Status
 * text only appears while listening / thinking / speaking so the user knows
 * what's happening.
 */
export default function StatusBar({
  speaking,
  listening,
  thinking,
  responseLanguage,
}: StatusBarProps) {
  const isAr = responseLanguage === 'ar';
  const isJa = responseLanguage === 'ja';

  let label = '';
  let color = 'text-muted-foreground';

  if (listening) {
    label = isAr ? 'أستمع…' : isJa ? '聞いています…' : 'Listening…';
    color = 'text-rose-300';
  } else if (thinking) {
    label = isAr ? '…' : isJa ? '…' : '…';
    color = 'text-blue-300';
  } else if (speaking) {
    label = isAr ? '…' : isJa ? '…' : '…';
    color = 'text-purple-300';
  }

  // Idle: render nothing so the screen stays clean.
  if (!label) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-1 text-center min-h-[1.25rem]" role="status" aria-live="polite" aria-atomic="true">
      <p className={`text-sm sm:text-base font-medium transition-colors ${color}`}>
        {label}
      </p>
    </div>
  );
}
