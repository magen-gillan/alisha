/**
 * Avatar registry — Live2D models and 3D (GLB) characters.
 *
 * Each entry describes one model. Live2D models ship in
 * /public/live2d/<id>/, 3D avatars in /public/models/<id>.glb.
 * The AvatarId type is used by the store so we can switch models at runtime.
 *
 * Adding a new model = add an entry here (+ the GLB / model3.json files).
 */

export type AvatarId =
  | 'kei' | 'jane' | 'icegirl' | 'ganyu' | 'miara'
  | 'alisha3d' | 'zaria3d' | 'akeno3d' | 'wanwan3d'
  | 'layla3d' | 'girl3d' | 'casual3d';

/**
 * Per-character motion profile — gives every 3D avatar her own style of
 * movement. All amplitude fields are multipliers around the base system in
 * Avatar3D.tsx; cadence fields are second ranges chosen at random each cycle.
 */
export interface Avatar3DMotion {
  /** Seconds between idle turns [min, max]; [0, 0] disables turning. */
  spinEvery: [number, number];
  /** Turn duration range in seconds. */
  turnDur: [number, number];
  /** Chance that a turn is a full 360° (the rest are half turns out-and-back). */
  fullChance: number;
  /** Seconds between forward/backward steps [min, max]; [0, 0] disables. */
  stepEvery: [number, number];
  /** Hand-gesture amplitude while speaking (unrigged/embedded models: unused). */
  gesture: number;
  /** Hair / skirt spring amplitude. */
  sway: number;
  /** Head / neck speech-beat amplitude. */
  talk: number;
  /** Vertical breathing-bob amplitude. */
  bob: number;
  /** Whole-model scale pulse (breathing illusion for unrigged figures). */
  pulse: number;
  /** The GLB ships real animations — drive it with an AnimationMixer. */
  embedded?: boolean;
}

export interface AvatarModel {
  /** URL-safe id, also the directory name under /public/live2d/. */
  id: AvatarId;
  /** Display name shown in the UI. */
  name: string;
  /** Path to the .model3.json file or the .glb file (relative to web root). */
  modelUrl: string;
  /** Renderer family: Live2D (PixiJS) or 3D (Three.js). Defaults to live2d. */
  kind?: 'live2d' | '3d';
  /** Optional short description shown under the name. */
  description?: string;
  /** Optional emoji/character used as a tiny preview chip. */
  emoji?: string;
  /** Optional thumbnail image URL (small preview shown in the picker). */
  thumbnailUrl?: string;
  /** Motion profile for 3D avatars (see Avatar3DMotion). */
  motion?: Avatar3DMotion;
  /** Fixed display calibration. normalizedX/Y are viewport-relative and non-editable. */
  calibration: {
    scale: number;
    xOffset: number;
    yOffset: number;
    normalizedX: number;
    normalizedY: number;
  };
  /**
   * MOC3 format version this model uses. The bundled Cubism Core
   * (v5, 2024+) supports versions 1-5. Older cores (2019) only support
   * 1-4, so v5 models (Kei, Jane) would silently fail to render.
   */
  moc3Version?: 3 | 4 | 5;
}

/** Baseline 3D motion (matches the original Galaxia "Alisha 3D" behaviour). */
const BASE_3D_MOTION: Avatar3DMotion = {
  spinEvery: [11, 20],
  turnDur: [2.6, 3.8],
  fullChance: 0.6,
  stepEvery: [7, 14],
  gesture: 1,
  sway: 1,
  talk: 1,
  bob: 1,
  pulse: 0,
};

export const AVATAR_MODELS: AvatarModel[] = [
  {
    id: 'kei',
    name: 'Kei',
    modelUrl: '/live2d/alisha/kei_basic_free.model3.json',
    description: 'Cubism 4 Sample',
    emoji: '👧',
    thumbnailUrl: '/live2d/thumbnails/kei-gallery.webp',
    calibration: { scale: 1.31, xOffset: 0, yOffset: 0, normalizedX: -0.029, normalizedY: -0.105 },
    moc3Version: 5,
  },
  {
    id: 'jane',
    name: 'Jane (简)',
    modelUrl: '/live2d/jane/jane.model3.json',
    description: 'Chinese-style avatar',
    emoji: '🧝',
    thumbnailUrl: '/live2d/thumbnails/jane-gallery.webp',
    calibration: { scale: 1.97, xOffset: 0, yOffset: 0, normalizedX: 0.050, normalizedY: 0.341 },
    moc3Version: 5,
  },
  {
    id: 'icegirl',
    name: 'IceGirl',
    modelUrl: '/live2d/icegirl/IceGirl.model3.json',
    description: 'Ice-themed avatar',
    emoji: '❄️',
    thumbnailUrl: '/live2d/thumbnails/icegirl.png',
    calibration: { scale: 3.45, xOffset: 0, yOffset: 0, normalizedX: 0.014, normalizedY: 0.622 },
    moc3Version: 4,
  },
  {
    id: 'ganyu',
    name: 'Gan Yu',
    modelUrl: '/live2d/ganyu/ganyu.model3.json',
    description: 'Genshin Impact style',
    emoji: '🐉',
    thumbnailUrl: '/live2d/thumbnails/ganyu-gallery.webp',
    calibration: { scale: 1.95, xOffset: 0, yOffset: 0, normalizedX: -0.006, normalizedY: 0.251 },
    moc3Version: 4,
  },
  {
    id: 'miara',
    name: 'Miara',
    modelUrl: '/live2d/miara/miara_pro_t03.model3.json',
    description: 'Pro avatar with motions',
    emoji: '✨',
    thumbnailUrl: '/live2d/thumbnails/miara-gallery.webp',
    calibration: { scale: 1.82, xOffset: 0, yOffset: 0, normalizedX: 0.012, normalizedY: 0.105 },
    moc3Version: 3,
  },
  {
    id: 'alisha3d',
    name: 'Alisha 3D',
    modelUrl: '/models/alisha-3d.glb',
    kind: '3d',
    description: 'أفاتار ثلاثي الأبعاد بأسلوب ملعب Mobile Legends',
    emoji: '🎮',
    thumbnailUrl: '/alisha-new-icon.png',
    motion: BASE_3D_MOTION,
    // Calibration values are unused by Avatar3D (it auto-frames the model),
    // kept here so the shared avatar registry shape stays consistent.
    calibration: { scale: 1, xOffset: 0, yOffset: 0, normalizedX: 0, normalizedY: 0 },
  },
  {
    // "anime 1girl zaria" — VRM-style rig, same bone family as Galaxia,
    // so the full procedural system applies (27 hair springs included).
    id: 'zaria3d',
    name: 'Zaria 3D',
    modelUrl: '/models/zaria.glb',
    kind: '3d',
    description: 'أنثوي رشيق — حركات بطيئة أنيقة وتأرجح شعر قوي',
    emoji: '🌸',
    thumbnailUrl: '/models/thumbs/zaria.png?v=2',
    motion: {
      ...BASE_3D_MOTION,
      spinEvery: [14, 24], turnDur: [3.0, 4.2], fullChance: 0.55,
      stepEvery: [9, 16], gesture: 0.85, sway: 1.4, talk: 0.9, bob: 0.8,
    },
    calibration: { scale: 1, xOffset: 0, yOffset: 0, normalizedX: 0, normalizedY: 0 },
  },
  {
    // Akeno Himejima (High School DxD) — converted from a Unity package.
    // Mixamo-style rig (UpperArm.L…), empty 0-frame clip → procedural.
    id: 'akeno3d',
    name: 'Akeno 3D',
    modelUrl: '/models/akeno.glb',
    kind: '3d',
    description: 'غامضة — لفّات بطيئة وتميلات رأس هادئة',
    emoji: '⚡',
    thumbnailUrl: '/models/thumbs/akeno.png?v=2',
    motion: {
      ...BASE_3D_MOTION,
      spinEvery: [16, 26], turnDur: [3.2, 4.4], fullChance: 0.5,
      stepEvery: [10, 18], gesture: 0.8, sway: 0.6, talk: 0.85, bob: 0.7,
    },
    calibration: { scale: 1, xOffset: 0, yOffset: 0, normalizedX: 0, normalizedY: 0 },
  },
  {
    // Wanwan (MLBB lobby model) — ships two real animation clips
    // (city_idle / city_action) played through an AnimationMixer.
    id: 'wanwan3d',
    name: 'Wanwan 3D',
    modelUrl: '/models/wanwan.glb',
    kind: '3d',
    description: 'أنيميشنات حقيقية مدمجة — حركة مستمرة + حركة قتال عند الكلام',
    emoji: '🐯',
    thumbnailUrl: '/models/thumbs/wanwan.png?v=2',
    motion: {
      ...BASE_3D_MOTION,
      spinEvery: [0, 0], stepEvery: [12, 20],
      gesture: 0, sway: 0.3, talk: 0, bob: 0.5, pulse: 0,
      embedded: true,
    },
    calibration: { scale: 1, xOffset: 0, yOffset: 0, normalizedX: 0, normalizedY: 0 },
  },
  {
    // Layla (MLBB) — no skeleton: rigid-body choreography only.
    // Sniper style: fast aim-sweep half turns + dashes.
    id: 'layla3d',
    name: 'Layla 3D',
    modelUrl: '/models/layla.glb',
    kind: '3d',
    description: 'قنّاصة نشطة — دورات سريعة واندفاع أمام/خلف',
    emoji: '🔫',
    thumbnailUrl: '/models/thumbs/layla.png?v=2',
    motion: {
      ...BASE_3D_MOTION,
      spinEvery: [8, 14], turnDur: [1.8, 2.8], fullChance: 0.3,
      stepEvery: [5, 9], gesture: 0, sway: 0, talk: 1.3, bob: 1.3, pulse: 0.005,
    },
    calibration: { scale: 1, xOffset: 0, yOffset: 0, normalizedX: 0, normalizedY: 0 },
  },
  {
    // "just a girl" — OBJ-derived static figure (no skeleton).
    id: 'girl3d',
    name: 'Girl 3D',
    modelUrl: '/models/girl.glb',
    kind: '3d',
    description: 'مرحة مرتقزة — نطّات خفيفة ودورات متكررة',
    emoji: '🎀',
    thumbnailUrl: '/models/thumbs/girl.png?v=2',
    motion: {
      ...BASE_3D_MOTION,
      spinEvery: [10, 16], turnDur: [2.2, 3.2], fullChance: 0.65,
      stepEvery: [6, 10], gesture: 0, sway: 0, talk: 1.1, bob: 1.6, pulse: 0.006,
    },
    calibration: { scale: 1, xOffset: 0, yOffset: 0, normalizedX: 0, normalizedY: 0 },
  },
  {
    // "anime girl casual outfit" — static figure (no skeleton).
    id: 'casual3d',
    name: 'Casual 3D',
    modelUrl: '/models/casual.glb',
    kind: '3d',
    description: 'عفوية مرحة — تحول وزن وميلات ودورات هادئة',
    emoji: '🧢',
    thumbnailUrl: '/models/thumbs/casual.png?v=2',
    motion: {
      ...BASE_3D_MOTION,
      spinEvery: [12, 20], turnDur: [2.6, 3.6], fullChance: 0.5,
      stepEvery: [7, 12], gesture: 0, sway: 0, talk: 1.0, bob: 1.2, pulse: 0.004,
    },
    calibration: { scale: 1, xOffset: 0, yOffset: 0, normalizedX: 0, normalizedY: 0 },
  },
];

export const DEFAULT_AVATAR: AvatarId = 'kei';

/** True when the avatar renders in the Three.js Avatar3D component. */
export function is3DAvatar(id: AvatarId | string | undefined): boolean {
  return getAvatarById(id).kind === '3d';
}

/** Motion profile of a 3D avatar (falls back to the baseline). */
export function getAvatarMotion(id: AvatarId | string | undefined): Avatar3DMotion {
  return getAvatarById(id).motion ?? BASE_3D_MOTION;
}

export function getAvatarById(id: AvatarId | string | undefined): AvatarModel {
  if (!id) return AVATAR_MODELS[0];
  return AVATAR_MODELS.find((m) => m.id === id) ?? AVATAR_MODELS[0];
}
