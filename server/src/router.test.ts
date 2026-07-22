import { TRPCError } from "@trpc/server";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { FakeLlmPort } from "./llm/fake.js";
import type { LlmPort } from "./llm/port.js";
import { createAppRouter } from "./router.js";

let dataDir: string;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "lilith-router-test-"));
});

function caller(dataDirOverride = dataDir, llm: LlmPort = new FakeLlmPort()) {
  const appRouter = createAppRouter({ llm, dataDir: dataDirOverride });
  return appRouter.createCaller({});
}

const baseCreateInput = {
  personalityDescription: "warm and curious",
  emotionalTendency: "quick to wonder",
  drive: "understand the user",
  avatarSet: "default",
};

/** Delays before delegating to a FakeLlmPort, so tests can control generation timing to exercise burst handling. Respects `signal` like a real network call would. */
function delayedLlm(delayMs: number): LlmPort {
  const inner = new FakeLlmPort();
  return {
    generateStructured: (args) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(inner.generateStructured(args)), delayMs);
        args.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new Error("aborted"));
        });
      }),
    embed: (text) => inner.embed(text),
  };
}

describe("character.listAvatarSets", () => {
  it("includes the sourced default avatar set", async () => {
    const sets = await caller().character.listAvatarSets();
    expect(sets).toContain("default");
  });
});

describe("character.create + character.get", () => {
  it("creates a character and then fetches it by id", async () => {
    const client = caller();
    const created = await client.character.create({
      personalityDescription: "warm and curious",
      emotionalTendency: "quick to wonder",
      drive: "understand the user",
      avatarSet: "default",
    });

    const fetched = await client.character.get({ id: created.id });
    expect(fetched).toEqual(created);
  });

  it("rejects an avatar set that was not sourced", async () => {
    const client = caller();
    await expect(
      client.character.create({
        personalityDescription: "warm and curious",
        emotionalTendency: "quick to wonder",
        drive: "understand the user",
        avatarSet: "not-a-real-set",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("character.get for an unknown id", () => {
  it("throws a plain NOT_FOUND with no distinguishing detail", async () => {
    const client = caller();
    try {
      await client.character.get({ id: "totally-unknown-id" });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("NOT_FOUND");
    }
  });
});

describe("conversation.sendMessage + conversation.history", () => {
  it("persists the user message and returns one complete character reply", async () => {
    const client = caller();
    const created = await client.character.create(baseCreateInput);

    const reply = await client.conversation.sendMessage({ id: created.id, text: "hi there" });
    expect(reply.sender).toBe("character");
    expect(reply.text.length).toBeGreaterThan(0);

    const history = await client.conversation.history({ id: created.id });
    expect(history.map((m) => m.sender)).toEqual(["user", "character"]);
    expect(history[0]?.text).toBe("hi there");
    expect(history[1]?.text).toBe(reply.text);
  });

  it("404s for an unknown character on both sendMessage and history", async () => {
    const client = caller();
    await expect(client.conversation.sendMessage({ id: "nope", text: "hi" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(client.conversation.history({ id: "nope" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("surfaces generation failure while keeping the user message persisted, with no character reply", async () => {
    const workingClient = caller();
    const created = await workingClient.character.create(baseCreateInput);

    const failingLlm: LlmPort = {
      generateStructured: async () => {
        throw new Error("ollama down");
      },
      embed: async () => [],
    };
    const failingClient = caller(dataDir, failingLlm);

    await expect(
      failingClient.conversation.sendMessage({ id: created.id, text: "hello" }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });

    const history = await workingClient.conversation.history({ id: created.id });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ sender: "user", text: "hello" });
  });

  it("runs a background Appraisal after each reply, so by the time the next turn starts the prior turn's messages carry real emotion_vector/peak_emotion_intensity instead of the zero placeholder", async () => {
    const client = caller();
    const created = await client.character.create(baseCreateInput);

    await client.conversation.sendMessage({ id: created.id, text: "I got the promotion!" });
    // sendMessage joins the previous turn's background Appraisal before starting —
    // this second call guarantees turn 1's Appraisal has finished by the time it resolves.
    await client.conversation.sendMessage({ id: created.id, text: "thanks!" });

    const history = await client.conversation.history({ id: created.id });
    const [turn1User, turn1Reply] = history;

    expect(turn1User?.peakEmotionIntensity).toBeGreaterThan(0);
    expect(turn1User?.peakEmotionIntensity).toBe(Math.max(...Object.values(turn1User!.emotionVector)));
    expect(turn1Reply?.emotionVector).toEqual(turn1User?.emotionVector);
    expect(turn1Reply?.peakEmotionIntensity).toBe(turn1User?.peakEmotionIntensity);
  });

  it("burst: a second message mid-generation restarts, yielding exactly one character reply that both calls resolve to", async () => {
    const client = caller(dataDir, delayedLlm(30));
    const created = await client.character.create(baseCreateInput);

    const [replyA, replyB] = await Promise.all([
      client.conversation.sendMessage({ id: created.id, text: "hey" }),
      (async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return client.conversation.sendMessage({ id: created.id, text: "wait nvm" });
      })(),
    ]);

    expect(replyA).toEqual(replyB);

    const history = await client.conversation.history({ id: created.id });
    expect(history.filter((m) => m.sender === "user").map((m) => m.text)).toEqual(["hey", "wait nvm"]);
    expect(history.filter((m) => m.sender === "character")).toHaveLength(1);
  });
});
