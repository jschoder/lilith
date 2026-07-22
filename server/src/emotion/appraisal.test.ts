import { describe, expect, it } from "vitest";
import type { CharacterDefinition } from "../character/types.js";
import { PLUTCHIK_PRIMARIES } from "../domain/plutchik.js";
import { FakeLlmPort } from "../llm/fake.js";
import type { LlmPort } from "../llm/port.js";
import { appraiseTurn } from "./appraisal.js";

const character: CharacterDefinition = {
  id: "char-1",
  name: "Astra",
  personalityDescription: "warm and curious",
  drive: "understand the user",
  avatarSet: "default",
  emotionalTendency: "quick to wonder",
  personalityPoint: { pleasure: 0.2, arousal: 0.1, dominance: 0 },
  baselineMood: {
    joy: 0.5,
    trust: 0.5,
    fear: 0.5,
    surprise: 0.5,
    sadness: 0.5,
    disgust: 0.5,
    anger: 0.5,
    anticipation: 0.5,
  },
  emotionConstants: {
    joy: { buildupGain: 0.8, emotionHalfLifeMinutes: 5, moodHalfLifeHours: 6 },
    trust: { buildupGain: 0.8, emotionHalfLifeMinutes: 5, moodHalfLifeHours: 6 },
    fear: { buildupGain: 0.8, emotionHalfLifeMinutes: 5, moodHalfLifeHours: 6 },
    surprise: { buildupGain: 0.8, emotionHalfLifeMinutes: 5, moodHalfLifeHours: 6 },
    sadness: { buildupGain: 0.8, emotionHalfLifeMinutes: 5, moodHalfLifeHours: 6 },
    disgust: { buildupGain: 0.8, emotionHalfLifeMinutes: 5, moodHalfLifeHours: 6 },
    anger: { buildupGain: 0.8, emotionHalfLifeMinutes: 5, moodHalfLifeHours: 6 },
    anticipation: { buildupGain: 0.8, emotionHalfLifeMinutes: 5, moodHalfLifeHours: 6 },
  },
};

describe("appraiseTurn", () => {
  it("returns a Stimulus with every present intensity in [0, 1]", async () => {
    const stimulus = await appraiseTurn(character, "I got the promotion!", "That's amazing, congratulations!", new FakeLlmPort());

    for (const primary of PLUTCHIK_PRIMARIES) {
      const intensity = stimulus[primary];
      if (intensity !== undefined) {
        expect(intensity).toBeGreaterThanOrEqual(0);
        expect(intensity).toBeLessThanOrEqual(1);
      }
    }
  });

  it("is deterministic for the same character and turn text", async () => {
    const llm = new FakeLlmPort();
    const a = await appraiseTurn(character, "hi", "hello!", llm);
    const b = await appraiseTurn(character, "hi", "hello!", llm);
    expect(a).toEqual(b);
  });

  it("passes character name and personality plus the turn's text through to the LLM call", async () => {
    let seenSystem = "";
    let seenPrompt = "";
    const llm: LlmPort = {
      generateStructured: async (args) => {
        seenSystem = args.system;
        seenPrompt = args.prompt;
        return {} as never;
      },
      embed: async () => [],
    };

    await appraiseTurn(character, "I got the promotion!", "That's amazing, congratulations!", llm);

    expect(seenSystem).toContain(character.name);
    expect(seenSystem).toContain(character.personalityDescription);
    expect(seenPrompt).toContain("I got the promotion!");
    expect(seenPrompt).toContain("That's amazing, congratulations!");
  });
});
