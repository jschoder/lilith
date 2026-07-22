import { describe, expect, it } from "vitest";
import type { CharacterDefinition } from "../character/types.js";
import { FakeLlmPort } from "../llm/fake.js";
import type { LlmPort } from "../llm/port.js";
import type { StoredMessage } from "./messages.js";
import { generateReply } from "./generate.js";

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

const history: StoredMessage[] = [
  {
    id: 1,
    sender: "user",
    text: "hi there",
    createdAt: new Date().toISOString(),
    emotionVector: character.baselineMood,
    peakEmotionIntensity: 0,
  },
];

describe("generateReply", () => {
  it("returns a single non-empty reply string, not a token stream", async () => {
    const reply = await generateReply(character, history, new FakeLlmPort());
    expect(typeof reply).toBe("string");
    expect(reply.length).toBeGreaterThan(0);
  });

  it("passes the abort signal through to the LLM call", async () => {
    const controller = new AbortController();
    let receivedSignal: AbortSignal | undefined;
    const llm: LlmPort = {
      generateStructured: async (args) => {
        receivedSignal = args.signal;
        return { reply: "ok" } as never;
      },
      embed: async () => [],
    };

    await generateReply(character, history, llm, controller.signal);
    expect(receivedSignal).toBe(controller.signal);
  });
});
