import { describe, expect, it } from "vitest";
import { PLUTCHIK_PRIMARIES } from "../domain/plutchik.js";
import { PLUTCHIK_PAD_TABLE, projectPersonality } from "./pad.js";

describe("projectPersonality", () => {
  it("gives an emotion baseline mood of 1 when the personality point points exactly at that emotion's PAD coordinate", () => {
    const { baselineMood } = projectPersonality(PLUTCHIK_PAD_TABLE.joy);
    expect(baselineMood.joy).toBeCloseTo(1, 5);
  });

  it("gives an emotion baseline mood of 0 when the personality point points exactly opposite that emotion's PAD coordinate", () => {
    const joyCoord = PLUTCHIK_PAD_TABLE.joy;
    const { baselineMood } = projectPersonality({
      pleasure: -joyCoord.pleasure,
      arousal: -joyCoord.arousal,
      dominance: -joyCoord.dominance,
    });
    expect(baselineMood.joy).toBeCloseTo(0, 5);
  });

  it("gives every emotion a neutral 0.5 baseline for a zero personality point", () => {
    const { baselineMood } = projectPersonality({ pleasure: 0, arousal: 0, dominance: 0 });
    for (const primary of PLUTCHIK_PRIMARIES) {
      expect(baselineMood[primary]).toBeCloseTo(0.5, 5);
    }
  });

  it("produces a baseline mood value in [0, 1] for every primary, for an arbitrary point", () => {
    const { baselineMood } = projectPersonality({ pleasure: 0.3, arousal: -0.8, dominance: 0.6 });
    for (const primary of PLUTCHIK_PRIMARIES) {
      expect(baselineMood[primary]).toBeGreaterThanOrEqual(0);
      expect(baselineMood[primary]).toBeLessThanOrEqual(1);
    }
  });

  it("is deterministic for the same input", () => {
    const point = { pleasure: 0.2, arousal: -0.4, dominance: 0.1 };
    expect(projectPersonality(point)).toEqual(projectPersonality(point));
  });

  it("derives emotion constants that scale monotonically with baseline mood alignment", () => {
    const { baselineMood, emotionConstants } = projectPersonality(PLUTCHIK_PAD_TABLE.anger);
    // anger itself should be maximally aligned (baselineMood.anger === 1), so its
    // buildup gain and half-lives should sit at the top of their range.
    expect(baselineMood.anger).toBeCloseTo(1, 5);
    expect(emotionConstants.anger.buildupGain).toBeCloseTo(1.0, 5);
    expect(emotionConstants.anger.emotionHalfLifeMinutes).toBeCloseTo(7.5, 5);
    expect(emotionConstants.anger.moodHalfLifeHours).toBeCloseTo(9, 5);

    // trust is anger's most weakly-aligned primary in the table, so it
    // should sit near the bottom of the range.
    expect(emotionConstants.trust.buildupGain).toBeLessThan(emotionConstants.anger.buildupGain);
    expect(emotionConstants.trust.emotionHalfLifeMinutes).toBeLessThan(
      emotionConstants.anger.emotionHalfLifeMinutes,
    );
  });
});
