import type { AvatarId } from './avatars';

const STORAGE_KEY = 'alisha.avatar-size-drafts.v1';

/** Read a previously saved, device-local absolute scale for an avatar. */
export function readAvatarSizeDraft(avatarId: AvatarId): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object') return null;
    const value = (parsed as Record<string, unknown>)[avatarId];
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

/** Persist only a user-requested size, on this browser/device. */
export function saveAvatarSizeDraft(avatarId: AvatarId, scale: number): boolean {
  if (typeof window === 'undefined' || !Number.isFinite(scale) || scale <= 0) return false;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    const drafts = parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...drafts, [avatarId]: scale }));
    return true;
  } catch {
    return false;
  }
}
