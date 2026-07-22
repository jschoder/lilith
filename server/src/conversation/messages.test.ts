import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { zeroEmotionVector } from "../domain/plutchik.js";
import { appendMessage, CREATE_MESSAGES_TABLE, listMessages, updateMessageEmotion } from "./messages.js";

let db: Client;

beforeEach(async () => {
  db = createClient({ url: "file::memory:" });
  await db.execute(CREATE_MESSAGES_TABLE);
});

afterEach(() => {
  db.close();
});

describe("appendMessage", () => {
  it("persists a message with a placeholder zero emotion vector and zero peak intensity", async () => {
    const stored = await appendMessage(db, "user", "hello there");

    expect(stored.sender).toBe("user");
    expect(stored.text).toBe("hello there");
    expect(stored.peakEmotionIntensity).toBe(0);
    expect(Object.values(stored.emotionVector)).toEqual(new Array(8).fill(0));
    expect(stored.id).toBeGreaterThan(0);
  });
});

describe("listMessages", () => {
  it("returns messages in chronological (insertion) order", async () => {
    await appendMessage(db, "user", "first");
    await appendMessage(db, "character", "second");
    await appendMessage(db, "user", "third");

    const messages = await listMessages(db);
    expect(messages.map((m) => [m.sender, m.text])).toEqual([
      ["user", "first"],
      ["character", "second"],
      ["user", "third"],
    ]);
  });

  it("returns an empty list for a fresh table", async () => {
    expect(await listMessages(db)).toEqual([]);
  });
});

describe("updateMessageEmotion", () => {
  it("replaces a message's placeholder emotion_vector/peak_emotion_intensity with real Appraisal output", async () => {
    const stored = await appendMessage(db, "user", "hello there");
    const emotionVector = { ...zeroEmotionVector(), joy: 0.6, anticipation: 0.3 };

    await updateMessageEmotion(db, stored.id, emotionVector, 0.6);

    const [updated] = await listMessages(db);
    expect(updated?.emotionVector).toEqual(emotionVector);
    expect(updated?.peakEmotionIntensity).toBe(0.6);
  });

  it("only updates the targeted message row", async () => {
    const first = await appendMessage(db, "user", "first");
    await appendMessage(db, "character", "second");

    await updateMessageEmotion(db, first.id, { ...zeroEmotionVector(), fear: 0.9 }, 0.9);

    const messages = await listMessages(db);
    expect(messages[0]?.peakEmotionIntensity).toBe(0.9);
    expect(messages[1]?.peakEmotionIntensity).toBe(0);
  });
});
