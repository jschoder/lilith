import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { withCharacterDb, writeCharacterDirectory } from "../character/store.js";
import type { CharacterDefinition } from "../character/types.js";
import { zeroEmotionVector } from "../domain/plutchik.js";
import { readEmotionState, writeEmotionState } from "../emotion/store.js";
import type { LlmPort } from "../llm/port.js";
import { appraiseAndPersist } from "./appraise.js";
import { appendMessage, listMessages } from "./messages.js";

let dataDir: string;

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
    joy: { buildupGain: 0.5, emotionHalfLifeMinutes: 5, moodHalfLifeHours: 6 },
    trust: { buildupGain: 0.5, emotionHalfLifeMinutes: 5, moodHalfLifeHours: 6 },
    fear: { buildupGain: 0.5, emotionHalfLifeMinutes: 5, moodHalfLifeHours: 6 },
    surprise: { buildupGain: 0.5, emotionHalfLifeMinutes: 5, moodHalfLifeHours: 6 },
    sadness: { buildupGain: 0.5, emotionHalfLifeMinutes: 5, moodHalfLifeHours: 6 },
    disgust: { buildupGain: 0.5, emotionHalfLifeMinutes: 5, moodHalfLifeHours: 6 },
    anger: { buildupGain: 0.5, emotionHalfLifeMinutes: 5, moodHalfLifeHours: 6 },
    anticipation: { buildupGain: 0.5, emotionHalfLifeMinutes: 5, moodHalfLifeHours: 6 },
  },
};

function fixedStimulusLlm(stimulus: Record<string, number>): LlmPort {
  return {
    generateStructured: async () => stimulus as never,
    embed: async () => [],
  };
}

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "lilith-appraise-test-"));
  await writeCharacterDirectory(character, dataDir);
});

describe("appraiseAndPersist", () => {
  it("applies the turn's Stimulus to persisted Emotion/Mood state and snapshots the result onto both new message rows", async () => {
    const { userMessage, replyMessage } = await withCharacterDb(character.id, dataDir, async (db) => ({
      userMessage: await appendMessage(db, "user", "I got the promotion!"),
      replyMessage: await appendMessage(db, "character", "That's amazing, congratulations!"),
    }));

    await appraiseAndPersist(character, dataDir, userMessage, replyMessage, fixedStimulusLlm({ joy: 1 }));

    const messages = await withCharacterDb(character.id, dataDir, listMessages);
    const [updatedUser, updatedReply] = messages;

    expect(updatedUser?.emotionVector.joy).toBeCloseTo(0.5, 3);
    expect(updatedUser?.peakEmotionIntensity).toBeCloseTo(0.5, 3);
    expect(updatedReply?.emotionVector).toEqual(updatedUser?.emotionVector);
    expect(updatedReply?.peakEmotionIntensity).toBe(updatedUser?.peakEmotionIntensity);

    const { state } = await withCharacterDb(character.id, dataDir, readEmotionState);
    expect(state.emotion.joy).toBeCloseTo(0.5, 3);
    expect(state.mood.joy).toBeCloseTo(0.25, 3);
  });

  it("decays existing persisted state by real elapsed time before applying this turn's (empty) stimulus", async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    await withCharacterDb(character.id, dataDir, (db) =>
      writeEmotionState(
        db,
        { emotion: { ...zeroEmotionVector(), joy: 0.8 }, mood: { ...zeroEmotionVector(), joy: 0.8 } },
        fiveMinutesAgo,
      ),
    );

    const { userMessage, replyMessage } = await withCharacterDb(character.id, dataDir, async (db) => ({
      userMessage: await appendMessage(db, "user", "hi"),
      replyMessage: await appendMessage(db, "character", "hello"),
    }));

    await appraiseAndPersist(character, dataDir, userMessage, replyMessage, fixedStimulusLlm({}));

    const { state } = await withCharacterDb(character.id, dataDir, readEmotionState);
    // One 5-minute emotion half-life elapsed, no buildup gain from an empty stimulus.
    expect(state.emotion.joy).toBeCloseTo(0.4, 2);
  });
});
