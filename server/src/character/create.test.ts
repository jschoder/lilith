import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { FakeLlmPort } from "../llm/fake.js";
import type { LlmPort } from "../llm/port.js";
import { createCharacter } from "./create.js";
import { readCharacterDefinition } from "./store.js";

let dataDir: string;

beforeEach(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "lilith-create-test-"));
});

const baseInput = {
  personalityDescription: "A curious, gentle scientist who loves rainy days.",
  emotionalTendency: "quick to wonder, slow to anger",
  drive: "understand the user completely",
  avatarSet: "default",
};

describe("createCharacter", () => {
  it("mints an id, infers a name, derives baselineMood/emotionConstants, and persists everything", async () => {
    const definition = await createCharacter(baseInput, new FakeLlmPort(), dataDir);

    expect(definition.id).toBeTruthy();
    expect(definition.name).toBeTruthy();
    expect(definition.personalityDescription).toBe(baseInput.personalityDescription);
    expect(definition.drive).toBe(baseInput.drive);
    expect(definition.avatarSet).toBe(baseInput.avatarSet);
    expect(Object.keys(definition.baselineMood)).toHaveLength(8);
    expect(Object.keys(definition.emotionConstants)).toHaveLength(8);

    const persisted = await readCharacterDefinition(definition.id, dataDir);
    expect(persisted).toEqual(definition);
  });

  it("keeps an explicitly provided name instead of inferring one", async () => {
    const definition = await createCharacter({ ...baseInput, name: "Astra" }, new FakeLlmPort(), dataDir);
    expect(definition.name).toBe("Astra");
  });

  it("infers a name when it is left blank", async () => {
    const definition = await createCharacter(baseInput, new FakeLlmPort(), dataDir);
    expect(definition.name.length).toBeGreaterThan(0);
  });

  it("leaves no character directory behind when the name-inference LLM call fails", async () => {
    const failingLlm: LlmPort = {
      generateStructured: async () => {
        throw new Error("simulated LLM outage");
      },
      embed: async () => [],
    };

    await expect(createCharacter(baseInput, failingLlm, dataDir)).rejects.toThrow("simulated LLM outage");
    expect(await readdir(dataDir)).toEqual([]);
  });

  it("leaves no character directory behind when the personality-point LLM call fails", async () => {
    let callCount = 0;
    const flakyLlm: LlmPort = {
      generateStructured: async (args) => {
        callCount += 1;
        // First call is name inference (name left blank); let it succeed,
        // then fail on the PAD-inference call that follows.
        if (callCount === 1) {
          return { name: "Placeholder" } as never;
        }
        throw new Error("simulated LLM outage on PAD inference");
      },
      embed: async () => [],
    };

    await expect(createCharacter(baseInput, flakyLlm, dataDir)).rejects.toThrow(
      "simulated LLM outage on PAD inference",
    );
    expect(await readdir(dataDir)).toEqual([]);
  });
});
