import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { zeroEmotionVector } from "../domain/plutchik.js";
import { readEmotionState } from "../emotion/store.js";
import { characterDir, openCharacterDb, readCharacterDefinition, writeCharacterDirectory } from "./store.js";
import type { CharacterDefinition } from "./types.js";

const sampleDefinition: CharacterDefinition = {
  id: "test-id-123",
  name: "Testa",
  personalityDescription: "curious and warm",
  drive: "understand the user",
  avatarSet: "default",
  emotionalTendency: "quick to trust",
  personalityPoint: { pleasure: 0.2, arousal: 0.1, dominance: 0.0 },
  baselineMood: {
    joy: 0.6,
    trust: 0.6,
    fear: 0.4,
    surprise: 0.5,
    sadness: 0.4,
    disgust: 0.4,
    anger: 0.4,
    anticipation: 0.5,
  },
  emotionConstants: {
    joy: { buildupGain: 0.8, emotionHalfLifeMinutes: 6, moodHalfLifeHours: 7 },
    trust: { buildupGain: 0.8, emotionHalfLifeMinutes: 6, moodHalfLifeHours: 7 },
    fear: { buildupGain: 0.7, emotionHalfLifeMinutes: 5, moodHalfLifeHours: 6 },
    surprise: { buildupGain: 0.75, emotionHalfLifeMinutes: 5.5, moodHalfLifeHours: 6.5 },
    sadness: { buildupGain: 0.7, emotionHalfLifeMinutes: 5, moodHalfLifeHours: 6 },
    disgust: { buildupGain: 0.7, emotionHalfLifeMinutes: 5, moodHalfLifeHours: 6 },
    anger: { buildupGain: 0.7, emotionHalfLifeMinutes: 5, moodHalfLifeHours: 6 },
    anticipation: { buildupGain: 0.75, emotionHalfLifeMinutes: 5.5, moodHalfLifeHours: 6.5 },
  },
};

let dataDir: string;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "lilith-store-test-"));
});

describe("writeCharacterDirectory", () => {
  it("writes definition.json, character.log, and an empty minor_goals table together", async () => {
    await writeCharacterDirectory(sampleDefinition, dataDir);

    const dir = characterDir(sampleDefinition.id, dataDir);
    const files = await readdir(dir);
    expect(files.sort()).toEqual(["character.db", "character.log", "definition.json"]);

    const written = JSON.parse(await readFile(path.join(dir, "definition.json"), "utf8"));
    expect(written).toEqual(sampleDefinition);
  });

  it("seeds a zero-initialized emotion_state singleton row", async () => {
    await writeCharacterDirectory(sampleDefinition, dataDir);

    const db = openCharacterDb(sampleDefinition.id, dataDir);
    try {
      const { state } = await readEmotionState(db);
      expect(state.emotion).toEqual(zeroEmotionVector());
      expect(state.mood).toEqual(zeroEmotionVector());
    } finally {
      db.close();
    }
  });

  it("leaves no directory behind when a step after mkdir fails", async () => {
    const failingDbFactory = () => {
      throw new Error("simulated DB failure");
    };

    await expect(
      writeCharacterDirectory(sampleDefinition, dataDir, { openDb: failingDbFactory }),
    ).rejects.toThrow("simulated DB failure");

    const entries = await readdir(dataDir);
    expect(entries).toEqual([]);
  });
});

describe("readCharacterDefinition", () => {
  it("returns null for an id that has no character directory", async () => {
    const result = await readCharacterDefinition("does-not-exist", dataDir);
    expect(result).toBeNull();
  });

  it("returns null for a malformed id instead of touching the filesystem", async () => {
    const result = await readCharacterDefinition("../../etc/passwd", dataDir);
    expect(result).toBeNull();
  });

  it("round-trips a written definition", async () => {
    await writeCharacterDirectory(sampleDefinition, dataDir);
    const result = await readCharacterDefinition(sampleDefinition.id, dataDir);
    expect(result).toEqual(sampleDefinition);
  });
});
