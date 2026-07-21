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
