import { describe, expect, it } from "vitest";
import { mintCharacterId } from "./id.js";

describe("mintCharacterId", () => {
  it("produces a URL-safe id with no padding or reserved characters", () => {
    const id = mintCharacterId();
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces ids with at least 128 bits of entropy", () => {
    const id = mintCharacterId();
    // base64url encodes 6 bits/char; 128 bits needs at least 22 chars.
    expect(id.length).toBeGreaterThanOrEqual(22);
  });

  it("never repeats across many mints", () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => mintCharacterId()));
    expect(ids.size).toBe(10_000);
  });
});
