import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendMessage, CREATE_MESSAGES_TABLE, listMessages } from "./messages.js";

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
