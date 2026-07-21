import {
  PLUTCHIK_PRIMARIES,
  type EmotionConstantsVector,
  type EmotionVector,
  type PadPoint,
  type PlutchikPrimary,
} from "../domain/plutchik.js";

/**
 * Canonical Plutchik-primary -> PAD coordinate table, per ADR-0002. `joy`
 * and `anger` are Mehrabian & Russell's published basic-emotion PAD values
 * (the `anger` point matches ALMA's own OCC->PAD table, Table 2). The
 * remaining six primaries have no published PAD coordinate in ticket 01's
 * survey and are hand-assigned here — ADR-0002 flags this heuristic as
 * invented for this project, not sourced.
 */
export const PLUTCHIK_PAD_TABLE: Record<PlutchikPrimary, PadPoint> = {
  joy: { pleasure: 0.81, arousal: 0.51, dominance: 0.46 },
  trust: { pleasure: 0.55, arousal: 0.1, dominance: 0.2 },
  fear: { pleasure: -0.64, arousal: 0.6, dominance: -0.43 },
  surprise: { pleasure: 0.4, arousal: 0.67, dominance: -0.13 },
  sadness: { pleasure: -0.63, arousal: -0.27, dominance: -0.33 },
  disgust: { pleasure: -0.6, arousal: 0.35, dominance: 0.11 },
  anger: { pleasure: -0.51, arousal: 0.59, dominance: 0.25 },
  anticipation: { pleasure: 0.35, arousal: 0.35, dominance: 0.25 },
};

const BASE_BUILDUP_GAIN = 0.5;
const BASE_EMOTION_HALF_LIFE_MINUTES = 5;
const BASE_MOOD_HALF_LIFE_HOURS = 6;

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function dot(a: PadPoint, b: PadPoint): number {
  return a.pleasure * b.pleasure + a.arousal * b.arousal + a.dominance * b.dominance;
}

function norm(a: PadPoint): number {
  return Math.sqrt(dot(a, a));
}

/**
 * Cosine alignment of `point` with each Plutchik primary's canonical PAD
 * coordinate, rescaled from [-1, 1] to [0, 1]. A point pointing exactly at
 * a primary's coordinate scores 1 for it; pointing exactly away scores 0;
 * a zero-length point (or a primary too close to compare) scores a neutral
 * 0.5 for every primary.
 */
function projectAlignment(point: PadPoint): EmotionVector {
  const pointNorm = norm(point);
  const result = {} as EmotionVector;
  for (const primary of PLUTCHIK_PRIMARIES) {
    const coord = PLUTCHIK_PAD_TABLE[primary];
    const coordNorm = norm(coord);
    const cosine = pointNorm === 0 || coordNorm === 0 ? 0 : dot(point, coord) / (pointNorm * coordNorm);
    result[primary] = clamp01((cosine + 1) / 2);
  }
  return result;
}

/**
 * Default per-emotion buildup-gain/decay-half-life constants, derived from
 * baseline mood alignment: a personality more aligned with an emotion
 * builds up faster and decays slower for that emotion. Invented for this
 * project per ADR-0002 — no source specifies this formula.
 */
function projectEmotionConstants(baselineMood: EmotionVector): EmotionConstantsVector {
  const result = {} as EmotionConstantsVector;
  for (const primary of PLUTCHIK_PRIMARIES) {
    const alignment = baselineMood[primary];
    result[primary] = {
      buildupGain: BASE_BUILDUP_GAIN + BASE_BUILDUP_GAIN * alignment,
      emotionHalfLifeMinutes: BASE_EMOTION_HALF_LIFE_MINUTES * (0.5 + alignment),
      moodHalfLifeHours: BASE_MOOD_HALF_LIFE_HOURS * (0.5 + alignment),
    };
  }
  return result;
}

export function projectPersonality(point: PadPoint): {
  baselineMood: EmotionVector;
  emotionConstants: EmotionConstantsVector;
} {
  const baselineMood = projectAlignment(point);
  return { baselineMood, emotionConstants: projectEmotionConstants(baselineMood) };
}
