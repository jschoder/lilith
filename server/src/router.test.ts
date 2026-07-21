import { TRPCError } from "@trpc/server";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { FakeLlmPort } from "./llm/fake.js";
import { createAppRouter } from "./router.js";

let dataDir: string;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "lilith-router-test-"));
});

function caller(dataDirOverride = dataDir) {
  const appRouter = createAppRouter({ llm: new FakeLlmPort(), dataDir: dataDirOverride });
  return appRouter.createCaller({});
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
