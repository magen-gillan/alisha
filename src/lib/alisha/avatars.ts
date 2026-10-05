/**
 * Live2D model registry.
 *
 * Each entry describes one model that ships in /public/live2d/<id>/. The
 * AvatarId type is used by the store so we can switch models at runtime.
 *
 * Adding a new model = add an entry here + drop the files in
 * public/live2d/<id>/<id>.model3.json. Nothing else needs to change.
 */

export type AvatarId = 'kei' | 'jane' | 'icegirl' | 'ganyu' | 'miara';

export interface AvatarModel {
  /** URL-safe id, also the directory name under /public/live2d/. */
  id: AvatarId;
  /** Display name shown in the UI. */
  name: string;
  /** Path to the .model3.json file (relative to web root). */
  modelUrl: string;
  /** Optional short description shown under the name. */
  description?: string;
  /** Optional emoji/character used as a tiny preview chip. */
  emoji?: string;
  /** Optional thumbnail image URL (small preview shown in the picker). */
  thumbnailUrl?: string;
  /**
   * MOC3 format version this model uses. The bundled Cubism Core
   * (v5, 2024+) supports versions 1-5. Older cores (2019) only support
   * 1-4, so v5 models (Kei, Jane) would silently fail to render.
   */
  moc3Version?: 3 | 4 | 5;
}

export const AVATAR_MODELS: AvatarModel[] = [
  {
    id: 'kei',
    name: 'Kei',
    modelUrl: '/live2d/alisha/kei_basic_free.model3.json',
    description: 'Cubism 4 Sample',
    emoji: '👧',
    thumbnailUrl: '/live2d/thumbnails/kei.png',
    moc3Version: 5,
  },
  {
    id: 'jane',
    name: 'Jane (简)',
    modelUrl: '/live2d/jane/jane.model3.json',
    description: 'Chinese-style avatar',
    emoji: '🧝',
    thumbnailUrl: '/live2d/thumbnails/jane.png',
    moc3Version: 5,
  },
  {
    id: 'icegirl',
    name: 'IceGirl',
    modelUrl: '/live2d/icegirl/IceGirl.model3.json',
    description: 'Ice-themed avatar',
    emoji: '❄️',
    thumbnailUrl: '/live2d/thumbnails/icegirl.png',
    moc3Version: 4,
  },
  {
    id: 'ganyu',
    name: 'Gan Yu',
    modelUrl: '/live2d/ganyu/ganyu.model3.json',
    description: 'Genshin Impact style',
    emoji: '🐉',
    thumbnailUrl: '/live2d/thumbnails/ganyu.png',
    moc3Version: 4,
  },
  {
    id: 'miara',
    name: 'Miara',
    modelUrl: '/live2d/miara/miara_pro_t03.model3.json',
    description: 'Pro avatar with motions',
    emoji: '✨',
    thumbnailUrl: '/live2d/thumbnails/miara.png',
    moc3Version: 3,
  },
];

export const DEFAULT_AVATAR: AvatarId = 'kei';

export function getAvatarById(id: AvatarId | string | undefined): AvatarModel {
  if (!id) return AVATAR_MODELS[0];
  return AVATAR_MODELS.find((m) => m.id === id) ?? AVATAR_MODELS[0];
}
