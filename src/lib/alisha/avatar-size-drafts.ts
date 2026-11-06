import type { AvatarId } from './avatars';

const STORAGE_KEY = 'alisha.avatar-size-drafts.v1';

export interface AvatarCalibrationDraft {
  scale: number;
  /** Normalized offsets relative to the avatar viewport (-0.75..0.75). */
  x: number;
  y: number;
}

const DEFAULT_CALIBRATION: AvatarCalibrationDraft = { scale: 1, x: 0, y: 0 };

/** Read the saved device-local size and position for one avatar. */
export function readAvatarCalibrationDraft(avatarId: AvatarId): AvatarCalibrationDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object') return null;
    const value = (parsed as Record<string, unknown>)[avatarId];
    // Migrate the previous scale-only draft without losing the user's saved zoom.
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return { ...DEFAULT_CALIBRATION, scale: value };
    }
    if (!value || typeof value !== 'object') return null;
    const draft = value as Record<string, unknown>;
    const scale = typeof draft.scale === 'number' && Number.isFinite(draft.scale) && draft.scale > 0
      ? draft.scale : null;
    if (scale === null) return null;
    const bounded = (candidate: unknown) => typeof candidate === 'number' && Number.isFinite(candidate)
      ? Math.max(-0.75, Math.min(0.75, candidate)) : 0;
    return { scale, x: bounded(draft.x), y: bounded(draft.y) };
  } catch {
    return null;
  }
}

/** Persist a user-requested size and position on this browser/device. */
export function saveAvatarCalibrationDraft(avatarId: AvatarId, calibration: AvatarCalibrationDraft): boolean {
  if (typeof window === 'undefined' || !Number.isFinite(calibration.scale) || calibration.scale <= 0) return false;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    const drafts = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    const bounded = (value: number) => Math.max(-0.75, Math.min(0.75, value));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...drafts,
      [avatarId]: { scale: calibration.scale, x: bounded(calibration.x), y: bounded(calibration.y) },
    }));
    return true;
  } catch {
    return false;
  }
}


/** Delete any saved size/position for an avatar (returns true if deleted). */
export function deleteAvatarCalibrationDraft(avatarId: AvatarId): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    const drafts = parsed && typeof parsed === 'object' ? { ...(parsed as Record<string, unknown>) } : {};
    delete drafts[avatarId];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
    return true;
  } catch {
    return false;
  }
}