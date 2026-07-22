import {
  OPPOSITE_PRIMARY,
  PLUTCHIK_PRIMARIES,
  type EmotionConstantsVector,
  type EmotionVector,
  type PlutchikPrimary,
} from "../domain/plutchik.js";
import { EMOTION_SUPPRESSION_FRACTION } from "../tuning.js";

export interface EmotionMoodState {
  emotion: EmotionVector;
  mood: EmotionVector;
}

/** Sparse LLM-judged Appraisal output (ADR-0001) — only the primaries a turn actually evoked. */
export type Stimulus = Partial<Record<PlutchikPrimary, number>>;

const MINUTES_TO_MS = 60_000;
const HOURS_TO_MS = 3_600_000;

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function decay(value: number, elapsedMs: number, halfLifeMs: number): number {
  return value * Math.pow(0.5, elapsedMs / halfLifeMs);
}

/**
 * Advances a Character's Emotion (fast) and Mood (slow) layers by one
 * Appraisal step (ticket 04/18): per-dimension exponential decay for
 * elapsed real time, then opposite-pair suppression and ALMA-style
 * pull/push buildup for whatever sparse Stimulus this turn evoked. Pure
 * and DB/LLM-free so the dynamics are independently testable.
 */
export function advanceEmotionMood(
  state: EmotionMoodState,
  elapsedMs: number,
  stimulus: Stimulus,
  constants: EmotionConstantsVector,
): EmotionMoodState {
  const decayedEmotion = {} as EmotionVector;
  const decayedMood = {} as EmotionVector;
  for (const primary of PLUTCHIK_PRIMARIES) {
    decayedEmotion[primary] = decay(
      state.emotion[primary],
      elapsedMs,
      constants[primary].emotionHalfLifeMinutes * MINUTES_TO_MS,
    );
    decayedMood[primary] = decay(state.mood[primary], elapsedMs, constants[primary].moodHalfLifeHours * HOURS_TO_MS);
  }

  // Suppression first, computed from the decayed baseline so processing
  // order doesn't matter even if both members of a pair are stimulated.
  const suppressedEmotion = { ...decayedEmotion };
  const suppressedMood = { ...decayedMood };
  for (const primary of PLUTCHIK_PRIMARIES) {
    const intensity = stimulus[primary];
    if (intensity === undefined) continue;
    const opposite = OPPOSITE_PRIMARY[primary];
    suppressedEmotion[opposite] = clamp01(suppressedEmotion[opposite] - intensity * EMOTION_SUPPRESSION_FRACTION);
    suppressedMood[opposite] = clamp01(suppressedMood[opposite] - intensity * EMOTION_SUPPRESSION_FRACTION);
  }

  // Buildup: Emotion spikes toward/past the stimulus; Mood is pulled toward
  // the spike (if still approaching it) or pushed further past it, once it's
  // already caught up — the mechanism that lets repeated stimuli escalate
  // Mood beyond what any single stimulus alone would justify.
  const nextEmotion = { ...suppressedEmotion };
  const nextMood = { ...suppressedMood };
  for (const primary of PLUTCHIK_PRIMARIES) {
    const intensity = stimulus[primary];
    if (intensity === undefined) continue;
    const buildupGain = constants[primary].buildupGain;

    const spiked = clamp01(suppressedEmotion[primary] + intensity * buildupGain);
    nextMood[primary] =
      suppressedMood[primary] < spiked
        ? clamp01(suppressedMood[primary] + buildupGain * (spiked - suppressedMood[primary]))
        : clamp01(suppressedMood[primary] + buildupGain * intensity);
    nextEmotion[primary] = spiked;
  }

  return { emotion: nextEmotion, mood: nextMood };
}
