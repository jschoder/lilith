export const PLUTCHIK_PRIMARIES = [
  "joy",
  "trust",
  "fear",
  "surprise",
  "sadness",
  "disgust",
  "anger",
  "anticipation",
] as const;

export type PlutchikPrimary = (typeof PLUTCHIK_PRIMARIES)[number];

export type EmotionVector = Record<PlutchikPrimary, number>;

export interface PadPoint {
  pleasure: number;
  arousal: number;
  dominance: number;
}

export interface EmotionConstants {
  buildupGain: number;
  emotionHalfLifeMinutes: number;
  moodHalfLifeHours: number;
}

export type EmotionConstantsVector = Record<PlutchikPrimary, EmotionConstants>;

/** Placeholder state for a newly-appended Message, before ticket 18's Appraisal fills in the real snapshot. */
export function zeroEmotionVector(): EmotionVector {
  return Object.fromEntries(PLUTCHIK_PRIMARIES.map((primary) => [primary, 0])) as EmotionVector;
}

/** Shared TEXT-column encoding for an EmotionVector, used by every `emotion_vector`/`emotion`/`mood` column across `messages` and `emotion_state`. */
export function serializeEmotionVector(vector: EmotionVector): string {
  return JSON.stringify(vector);
}

export function parseEmotionVector(json: string): EmotionVector {
  return JSON.parse(json) as EmotionVector;
}

/** Plutchik's 4 bipolar opposite pairs (Postulate 8), used for appraisal-time suppression per ADR-0001. */
export const OPPOSITE_PRIMARY: Record<PlutchikPrimary, PlutchikPrimary> = {
  joy: "sadness",
  sadness: "joy",
  trust: "disgust",
  disgust: "trust",
  fear: "anger",
  anger: "fear",
  surprise: "anticipation",
  anticipation: "surprise",
};
