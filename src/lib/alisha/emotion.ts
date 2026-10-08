/**
 * Emotion analysis for Alisha's responses.
 *
 * Inspired by Prometheus-avatar's emotion engine — analyzes the AI's
 * response text and detects the dominant emotion, then maps it to
 * Live2D expression parameters that the avatar can display.
 *
 * Emotions supported:
 *  - happy     → smile, raised cheeks
 *  - sad       → lowered mouth corners, drooped eyes
 *  - angry     → narrowed eyes, furrowed brow
 *  - surprised → wide eyes, raised brows
 *  - neutral   → default expression
 */

export type Emotion = 'happy' | 'sad' | 'angry' | 'surprised' | 'neutral';

export interface EmotionParams {
  /** Mouth form: -1 (frown) to 1 (smile) */
  mouthForm: number;
  /** Mouth open: 0 (closed) to 1 (wide open) */
  mouthOpenY: number;
  /** Eye openness: 0 (closed) to 1 (wide) */
  eyeLOpen: number;
  /** Eye openness: 0 (closed) to 1 (wide) */
  eyeROpen: number;
  /** Eyebrow angle: -1 (down/angry) to 1 (up/surprised) */
  browAngle: number;
  /** Cheek blush: 0 (none) to 1 (red) */
  cheekPuff: number;
}

const EMOTION_PARAMS: Record<Emotion, EmotionParams> = {
  happy:     { mouthForm: 0.8, mouthOpenY: 0.2, eyeLOpen: 0.9, eyeROpen: 0.9, browAngle: 0.3, cheekPuff: 0.4 },
  sad:       { mouthForm: -0.6, mouthOpenY: 0.1, eyeLOpen: 0.6, eyeROpen: 0.6, browAngle: -0.4, cheekPuff: 0 },
  angry:     { mouthForm: -0.7, mouthOpenY: 0.3, eyeLOpen: 0.5, eyeROpen: 0.5, browAngle: -0.8, cheekPuff: 0 },
  surprised: { mouthForm: 0.1, mouthOpenY: 0.7, eyeLOpen: 1.0, eyeROpen: 1.0, browAngle: 0.8, cheekPuff: 0 },
  neutral:   { mouthForm: 0, mouthOpenY: 0, eyeLOpen: 0.9, eyeROpen: 0.9, browAngle: 0, cheekPuff: 0 },
};

// Keyword patterns for each emotion (Arabic + English + Japanese)
const EMOTION_PATTERNS: Record<Emotion, RegExp[]> = {
  happy: [
    /سعيد|فرح|ممتاز|رائع|haha|ههه|😊|😄|😍|❤️|شكراً|مبروك|good|great|awesome|happy|love|wonderful|素晴らしい|嬉しい|ありがとう/i,
  ],
  sad: [
    /حزين|آسف|للأسف|مؤسف|محزن|sad|sorry|unfortunately|regret|悲しい|残念|申し訳/i,
  ],
  angry: [
    /غاضب|غضبان|لا تفعل|توقف|angry|stop|don't|must not|怒る|ダメ|止ま/i,
  ],
  surprised: [
    /مستحيل|واو|عجيب|حقاً|wow|really|incredible|amazing|unexpected|すごい|本当|まさか/i,
  ],
  neutral: [],
};

/**
 * Detect the dominant emotion in a text response.
 * Returns 'neutral' if no strong emotion is detected.
 */
export function detectEmotion(text: string): Emotion {
  if (!text || !text.trim()) return 'neutral';

  const scores: Record<Emotion, number> = {
    happy: 0, sad: 0, angry: 0, surprised: 0, neutral: 0,
  };

  for (const emotion of ['happy', 'sad', 'angry', 'surprised'] as Emotion[]) {
    for (const pattern of EMOTION_PATTERNS[emotion]) {
      if (pattern.test(text)) {
        scores[emotion] += 1;
      }
    }
  }

  // Find the emotion with the highest score.
  let maxEmotion: Emotion = 'neutral';
  let maxScore = 0;
  for (const emotion of Object.keys(scores) as Emotion[]) {
    if (scores[emotion] > maxScore) {
      maxScore = scores[emotion];
      maxEmotion = emotion;
    }
  }

  return maxScore > 0 ? maxEmotion : 'neutral';
}

/**
 * Get the Live2D parameter values for a given emotion.
 * These can be blended into the avatar's animation loop.
 */
export function getEmotionParams(emotion: Emotion): EmotionParams {
  return EMOTION_PARAMS[emotion] || EMOTION_PARAMS.neutral;
}

/**
 * Blend two emotion param sets (for smooth transitions).
 * t=0 → fully 'from', t=1 → fully 'to'
 */
export function blendEmotions(from: EmotionParams, to: EmotionParams, t: number): EmotionParams {
  const clampedT = Math.max(0, Math.min(1, t));
  return {
    mouthForm: from.mouthForm + (to.mouthForm - from.mouthForm) * clampedT,
    mouthOpenY: from.mouthOpenY + (to.mouthOpenY - from.mouthOpenY) * clampedT,
    eyeLOpen: from.eyeLOpen + (to.eyeLOpen - from.eyeLOpen) * clampedT,
    eyeROpen: from.eyeROpen + (to.eyeROpen - from.eyeROpen) * clampedT,
    browAngle: from.browAngle + (to.browAngle - from.browAngle) * clampedT,
    cheekPuff: from.cheekPuff + (to.cheekPuff - from.cheekPuff) * clampedT,
  };
}
