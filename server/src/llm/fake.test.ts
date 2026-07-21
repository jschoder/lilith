import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FakeLlmPort } from "./fake.js";

describe("FakeLlmPort.generateStructured", () => {
  it("returns a value that satisfies the given schema", async () => {
    const llm = new FakeLlmPort();
    const schema = z.object({
      pleasure: z.number().min(-1).max(1),
      arousal: z.number().min(-1).max(1),
      dominance: z.number().min(-1).max(1),
    });
    const result = await llm.generateStructured({ system: "s", prompt: "p", schema });
    expect(() => schema.parse(result)).not.toThrow();
  });

  it("is deterministic for the same system+prompt+schema", async () => {
    const llm = new FakeLlmPort();
    const schema = z.object({ name: z.string() });
    const a = await llm.generateStructured({ system: "s", prompt: "hello", schema });
    const b = await llm.generateStructured({ system: "s", prompt: "hello", schema });
    expect(a).toEqual(b);
  });

  it("varies output for different prompts", async () => {
    const llm = new FakeLlmPort();
    const schema = z.object({ name: z.string() });
    const a = await llm.generateStructured({ system: "s", prompt: "hello", schema });
    const b = await llm.generateStructured({ system: "s", prompt: "goodbye", schema });
    expect(a).not.toEqual(b);
  });

  it("picks one of the declared options for an enum field", async () => {
    const llm = new FakeLlmPort();
    const schema = z.object({ mood: z.enum(["good", "bad", "neutral"]) });
    const result = await llm.generateStructured({ system: "s", prompt: "p", schema });
    expect(["good", "bad", "neutral"]).toContain(result.mood);
  });
});

describe("FakeLlmPort.embed", () => {
  it("returns a fixed-length numeric vector, deterministic per input", async () => {
    const llm = new FakeLlmPort();
    const a = await llm.embed("hello world");
    const b = await llm.embed("hello world");
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
    expect(a.every((n) => typeof n === "number" && Number.isFinite(n))).toBe(true);
  });

  it("varies the vector for different input", async () => {
    const llm = new FakeLlmPort();
    const a = await llm.embed("hello");
    const b = await llm.embed("goodbye");
    expect(a).not.toEqual(b);
  });
});
