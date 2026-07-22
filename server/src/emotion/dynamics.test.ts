import { describe, expect, it } from "vitest";
import {
  PLUTCHIK_PRIMARIES,
  zeroEmotionVector,
  type EmotionConstants,
  type EmotionConstantsVector,
  type PlutchikPrimary,
} from "../domain/plutchik.js";
import { EMOTION_SUPPRESSION_FRACTION } from "../tuning.js";
import { advanceEmotionMood, type EmotionMoodState } from "./dynamics.js";

const DEFAULT_CONSTANTS: EmotionConstants = {
  buildupGain: 0.5,
  emotionHalfLifeMinutes: 5,
  moodHalfLifeHours: 6,
};

function constantsFor(overrides: Partial<Record<PlutchikPrimary, Partial<EmotionConstants>>> = {}): EmotionConstantsVector {
  return Object.fromEntries(
    PLUTCHIK_PRIMARIES.map((primary) => [primary, { ...DEFAULT_CONSTANTS, ...overrides[primary] }]),
  ) as EmotionConstantsVector;
}

function zeroState(): EmotionMoodState {
  return { emotion: zeroEmotionVector(), mood: zeroEmotionVector() };
}

function stateWith(overrides: { emotion?: Partial<Record<PlutchikPrimary, number>>; mood?: Partial<Record<PlutchikPrimary, number>> }): EmotionMoodState {
  return {
    emotion: { ...zeroEmotionVector(), ...overrides.emotion },
    mood: { ...zeroEmotionVector(), ...overrides.mood },
  };
}

describe("advanceEmotionMood", () => {
  it("is a pure function: same inputs produce the same (deep-equal) output and never mutate the input state", () => {
    const state = stateWith({ emotion: { joy: 0.4 }, mood: { joy: 0.3 } });
    const constants = constantsFor();

    const resultA = advanceEmotionMood(state, 1000, { joy: 0.2 }, constants);
    const resultB = advanceEmotionMood(state, 1000, { joy: 0.2 }, constants);

    expect(resultA).toEqual(resultB);
    expect(state).toEqual(stateWith({ emotion: { joy: 0.4 }, mood: { joy: 0.3 } }));
  });

  it("leaves state unchanged for zero elapsed time and an empty stimulus", () => {
    const state = stateWith({ emotion: { joy: 0.4, fear: 0.2 }, mood: { joy: 0.3, fear: 0.1 } });
    const result = advanceEmotionMood(state, 0, {}, constantsFor());
    expect(result).toEqual(state);
  });

  it("decays the Emotion layer over elapsed time using that emotion's own half-life, independent of a near-frozen Mood layer", () => {
    const state = stateWith({ emotion: { joy: 0.8 }, mood: { joy: 0.8 } });
    const constants = constantsFor({
      joy: { emotionHalfLifeMinutes: 5, moodHalfLifeHours: 1_000_000 },
    });

    const result = advanceEmotionMood(state, 5 * 60_000, {}, constants);

    expect(result.emotion.joy).toBeCloseTo(0.4, 5);
    expect(result.mood.joy).toBeCloseTo(0.8, 3);
  });

  it("decays the Mood layer over elapsed time using that emotion's own half-life, independent of a near-frozen Emotion layer", () => {
    const state = stateWith({ emotion: { joy: 0.8 }, mood: { joy: 0.8 } });
    const constants = constantsFor({
      joy: { emotionHalfLifeMinutes: 1_000_000 * 60, moodHalfLifeHours: 6 },
    });

    const result = advanceEmotionMood(state, 6 * 3_600_000, {}, constants);

    expect(result.mood.joy).toBeCloseTo(0.4, 5);
    expect(result.emotion.joy).toBeCloseTo(0.8, 3);
  });

  it("spikes the Emotion layer immediately from a single stimulus while the Mood layer only moves partway toward it (pull phase)", () => {
    const constants = constantsFor({ joy: { buildupGain: 0.5 } });
    const result = advanceEmotionMood(zeroState(), 0, { joy: 1 }, constants);

    expect(result.emotion.joy).toBeCloseTo(0.5, 5);
    expect(result.mood.joy).toBeCloseTo(0.25, 5);
    expect(result.mood.joy).toBeLessThan(result.emotion.joy);
  });

  it("pushes Mood further past a weaker new stimulus once Mood has already caught up to or passed Emotion (push phase)", () => {
    // Emotion decayed away faster than Mood between turns, so Mood(0.6) now
    // sits above this turn's freshly-spiked Emotion(0.35) before the push.
    const state = stateWith({ emotion: { joy: 0.1 }, mood: { joy: 0.6 } });
    const constants = constantsFor({ joy: { buildupGain: 0.5 } });

    const result = advanceEmotionMood(state, 0, { joy: 0.5 }, constants);

    expect(result.emotion.joy).toBeCloseTo(0.35, 5);
    expect(result.mood.joy).toBeCloseTo(0.85, 5);
    // The key escalation property: repeated same-direction stimuli push Mood
    // past what this single stimulus's own Emotion spike would justify.
    expect(result.mood.joy).toBeGreaterThan(result.emotion.joy);
  });

  it("dampens the opposite emotion in a Plutchik pair by intensity * the configured suppression fraction", () => {
    const state = stateWith({ emotion: { sadness: 0.5 }, mood: { sadness: 0.5 } });
    const constants = constantsFor();

    const result = advanceEmotionMood(state, 0, { joy: 1 }, constants);

    const expected = 0.5 - 1 * EMOTION_SUPPRESSION_FRACTION;
    expect(result.emotion.sadness).toBeCloseTo(expected, 5);
    expect(result.mood.sadness).toBeCloseTo(expected, 5);
  });

  it("clamps suppression at 0 rather than going negative", () => {
    const state = stateWith({ emotion: { sadness: 0.1 }, mood: { sadness: 0.1 } });
    const result = advanceEmotionMood(state, 0, { joy: 1 }, constantsFor());

    expect(result.emotion.sadness).toBe(0);
    expect(result.mood.sadness).toBe(0);
  });

  it("only applies buildup/suppression for primaries present in the sparse stimulus, leaving others to decay only", () => {
    const state = stateWith({ emotion: { trust: 0.5 }, mood: { trust: 0.5 } });
    const result = advanceEmotionMood(state, 0, { joy: 1 }, constantsFor());

    // trust is unrelated to joy/sadness — untouched by suppression or buildup at elapsed=0.
    expect(result.emotion.trust).toBe(0.5);
    expect(result.mood.trust).toBe(0.5);
  });
});
