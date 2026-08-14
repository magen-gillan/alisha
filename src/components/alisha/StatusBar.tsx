'use client';

interface StatusBarProps {
  speaking: boolean;
  listening: boolean;
  thinking: boolean;
  responseLanguage: string;
}

export default function StatusBar({
  speaking,
  listening,
  thinking,
  responseLanguage,
}: StatusBarProps) {
  // Localize the status text based on the response language.
  // The status bar should speak the user's language, not always English.
  const isAr = responseLanguage === 'ar';
  const isJa = responseLanguage === 'ja';

  let label = isAr
    ? 'اضغط الميكروفون للتحدث مع اليشيا'
    : isJa
    ? 'マイクをタップしてアリーシャと話す'
    : 'Tap the mic to talk to Alisha';
  let color = 'text-muted-foreground';

  if (listening) {
    label = isAr ? 'أستمع…' : isJa ? '聞いています…' : 'Listening…';
    color = 'text-rose-300';
  } else if (thinking) {
    label = isAr ? 'اليشيا تفكر…' : isJa ? 'アリーシャが考えています…' : 'Alisha is thinking…';
    color = 'text-blue-300';
  } else if (speaking) {
    label = isAr ? 'اليشيا تتحدث…' : isJa ? 'アリーシャが話しています…' : 'Alisha is speaking…';
    color = 'text-purple-300';
  }

  const respondingIn = isAr
    ? 'الرد بالعربية'
    : isJa
    ? '日本語で応答中'
    : 'Responding in English';

  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <p className={`text-sm sm:text-base font-medium transition-colors ${color}`}>
        {label}
      </p>
      <p className="text-xs text-muted-foreground/70">
        {respondingIn}
      </p>
    </div>
  );
}
