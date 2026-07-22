import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { zeroEmotionVector } from "../domain/plutchik.js";
import { CREATE_EMOTION_STATE_TABLE, initializeEmotionState, readEmotionState, writeEmotionState } from "./store.js";

let db: Client;

beforeEach(async () => {
  db = createClient({ url: "file::memory:" });
  await db.execute(CREATE_EMOTION_STATE_TABLE);
});

afterEach(() => {
  db.close();
});

describe("initializeEmotionState + readEmotionState", () => {
  it("seeds an all-zero Emotion/Mood singleton row at the given timestamp", async () => {
    await initializeEmotionState(db, "2026-01-01T00:00:00.000Z");

    const { state, updatedAt } = await readEmotionState(db);
    expect(state.emotion).toEqual(zeroEmotionVector());
    expect(state.mood).toEqual(zeroEmotionVector());
    expect(updatedAt).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("writeEmotionState", () => {
  it("round-trips a written Emotion/Mood state and updated_at back through readEmotionState", async () => {
    await initializeEmotionState(db, "2026-01-01T00:00:00.000Z");

    const next = {
      emotion: { ...zeroEmotionVector(), joy: 0.7 },
      mood: { ...zeroEmotionVector(), joy: 0.4 },
    };
    await writeEmotionState(db, next, "2026-01-01T00:05:00.000Z");

    const { state, updatedAt } = await readEmotionState(db);
    expect(state).toEqual(next);
    expect(updatedAt).toBe("2026-01-01T00:05:00.000Z");
  });

  it("overwrites the same singleton row rather than inserting a new one", async () => {
    await initializeEmotionState(db, "2026-01-01T00:00:00.000Z");
    await writeEmotionState(db, { emotion: zeroEmotionVector(), mood: zeroEmotionVector() }, "t1");
    await writeEmotionState(db, { emotion: zeroEmotionVector(), mood: zeroEmotionVector() }, "t2");

    const count = await db.execute("SELECT COUNT(*) as n FROM emotion_state");
    expect((count.rows[0] as unknown as { n: number }).n).toBe(1);
  });
});
