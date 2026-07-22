import { describe, expect, it } from "vitest";
import { ConversationManager } from "./session.js";

interface Controllable {
  generate: (signal: AbortSignal) => Promise<string>;
  resolve: (value: string) => void;
  aborted: () => boolean;
}

function controllableGenerate(): Controllable {
  let resolve!: (value: string) => void;
  let abortedFlag = false;
  const generate = (signal: AbortSignal) =>
    new Promise<string>((res, rej) => {
      resolve = res;
      signal.addEventListener("abort", () => {
        abortedFlag = true;
        rej(new Error("aborted"));
      });
    });
  return { generate, resolve: (value) => resolve(value), aborted: () => abortedFlag };
}

describe("ConversationManager", () => {
  it("resolves a single request to its own result", async () => {
    const manager = new ConversationManager<string>(3);
    const result = await manager.requestReply("char-1", async () => "reply-A");
    expect(result).toBe("reply-A");
  });

  it("cancels the in-flight generation and resolves all callers to the restarted result", async () => {
    const manager = new ConversationManager<string>(3);
    const genA = controllableGenerate();
    const genB = controllableGenerate();

    const callA = manager.requestReply("char-1", genA.generate);
    const callB = manager.requestReply("char-1", genB.generate);

    expect(genA.aborted()).toBe(true);

    genB.resolve("reply-B");

    await expect(callA).resolves.toBe("reply-B");
    await expect(callB).resolves.toBe("reply-B");
  });

  it("stops restarting once the cap is reached, sharing the still-in-flight generation", async () => {
    const manager = new ConversationManager<string>(1); // one restart allowed
    const gens = [controllableGenerate(), controllableGenerate(), controllableGenerate()];
    let callCount = 0;
    function nextGenerate(signal: AbortSignal) {
      const gen = gens[callCount];
      if (!gen) throw new Error("unexpected extra generation start");
      callCount += 1;
      return gen.generate(signal);
    }

    const call1 = manager.requestReply("char-1", nextGenerate); // initial
    const call2 = manager.requestReply("char-1", nextGenerate); // restart #1 (cap allows it)
    const call3 = manager.requestReply("char-1", nextGenerate); // over cap — should NOT start a third generation

    expect(callCount).toBe(2);

    gens[1]!.resolve("reply-restart-1");

    await expect(call1).resolves.toBe("reply-restart-1");
    await expect(call2).resolves.toBe("reply-restart-1");
    await expect(call3).resolves.toBe("reply-restart-1");
  });

  it("resets after a failure so the next request starts fresh", async () => {
    const manager = new ConversationManager<string>(3);

    await expect(
      manager.requestReply("char-1", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const result = await manager.requestReply("char-1", async () => "reply-fresh");
    expect(result).toBe("reply-fresh");
  });

  it("keeps separate sessions per character", async () => {
    const manager = new ConversationManager<string>(3);
    const genA = controllableGenerate();

    const callA = manager.requestReply("char-1", genA.generate);
    const resultB = await manager.requestReply("char-2", async () => "reply-B");
    expect(resultB).toBe("reply-B");

    expect(genA.aborted()).toBe(false);
    genA.resolve("reply-A");
    await expect(callA).resolves.toBe("reply-A");
  });
});
