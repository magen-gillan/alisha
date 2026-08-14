'use client';

import type { BackgroundId } from '@/lib/alisha/types';

interface BackgroundLayerProps {
  background: BackgroundId;
}

const BACKGROUND_IMAGES: Record<BackgroundId, string> = {
  aurora: '/backgrounds/aurora.webp',
  sunset: '/backgrounds/sakura.webp',
  midnight: '/backgrounds/moonlit.webp',
  sakura: '/backgrounds/cloudroom.webp',
};

/** Image-based scene backgrounds with a subtle readability veil. */
export default function BackgroundLayer({ background }: BackgroundLayerProps) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-0 overflow-hidden bg-[#211a31]"
    >
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-[background-image] duration-700"
        style={{ backgroundImage: `url(${BACKGROUND_IMAGES[background]})` }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,250,255,0.12),rgba(27,18,48,0.44)_78%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#120d24]/20 via-transparent to-[#120d24]/60" />
    </div>
  );
}

export { BACKGROUND_IMAGES };

/* The generated scenes keep the center low-contrast for avatar readability. */
