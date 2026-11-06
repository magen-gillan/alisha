import type { AvatarId } from './avatars';

export interface AvatarCalibration {
  scale: number;
  xOffset: number;
  yOffset: number;
}

export interface AvatarStudioDraft {
  calibrations: Partial<Record<AvatarId, AvatarCalibration>>;
  thumbnails: Partial<Record<AvatarId, string>>;
}

const STORAGE_KEY = 'alisha-avatar-studio-draft-v1';
const DEFAULT_CALIBRATION: AvatarCalibration = { scale: 1, xOffset: 0, yOffset: 0 };

function isAvatarId(value: string): value is AvatarId {
  return ['kei', 'jane', 'icegirl', 'ganyu', 'miara'].includes(value);
}

export function loadAvatarStudioDraft(): AvatarStudioDraft {
  if (typeof window === 'undefined') return { calibrations: {}, thumbnails: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { calibrations: {}, thumbnails: {} };
    const parsed = JSON.parse(raw) as Partial<AvatarStudioDraft>;
    const calibrations: AvatarStudioDraft['calibrations'] = {};
    const thumbnails: AvatarStudioDraft['thumbnails'] = {};
    for (const [id, value] of Object.entries(parsed.calibrations || {})) {
      if (!isAvatarId(id) || !value || typeof value !== 'object') continue;
      const candidate = value as AvatarCalibration;
      if ([candidate.scale, candidate.xOffset, candidate.yOffset].every(Number.isFinite)) {
        calibrations[id] = {
          scale: Math.max(0.3, Math.min(2, candidate.scale)),
          xOffset: Math.max(-240, Math.min(240, candidate.xOffset)),
          yOffset: Math.max(-240, Math.min(240, candidate.yOffset)),
        };
      }
    }
    for (const [id, data] of Object.entries(parsed.thumbnails || {})) {
      if (isAvatarId(id) && typeof data === 'string' && data.startsWith('data:image/webp;base64,')) {
        thumbnails[id] = data;
      }
    }
    return { calibrations, thumbnails };
  } catch {
    return { calibrations: {}, thumbnails: {} };
  }
}

export function saveAvatarStudioDraft(draft: AvatarStudioDraft): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    window.dispatchEvent(new Event('alisha:avatar-studio-draft-updated'));
    return true;
  } catch {
    return false;
  }
}

export function getAvatarCalibration(id: AvatarId): AvatarCalibration {
  return loadAvatarStudioDraft().calibrations[id] || DEFAULT_CALIBRATION;
}
