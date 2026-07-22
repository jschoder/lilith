import { describe, expect, it } from "vitest";
import { BackgroundJobs } from "./background-jobs.js";

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (err: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("BackgroundJobs", () => {
  it("resolves immediately when nothing has been tracked for a character", async () => {
    const jobs = new BackgroundJobs();
    await expect(jobs.join("char-1")).resolves.toBeUndefined();
  });

  it("waits for a tracked job to settle before resolving join", async () => {
    const jobs = new BackgroundJobs();
    const job = deferred<void>();
    jobs.track("char-1", job.promise);

    let joined = false;
    const joinPromise = jobs.join("char-1").then(() => {
      joined = true;
    });

    await Promise.resolve();
    expect(joined).toBe(false);

    job.resolve();
    await joinPromise;
    expect(joined).toBe(true);
  });

  it("swallows a tracked job's rejection so join never throws and future turns aren't blocked", async () => {
    const jobs = new BackgroundJobs();
    const job = deferred<void>();
    jobs.track("char-1", job.promise);
    job.reject(new Error("appraisal LLM call failed"));

    await expect(jobs.join("char-1")).resolves.toBeUndefined();
  });

  it("keeps separate tracked jobs per character", async () => {
    const jobs = new BackgroundJobs();
    const jobA = deferred<void>();
    jobs.track("char-1", jobA.promise);

    let joinedB = false;
    await jobs.join("char-2").then(() => {
      joinedB = true;
    });
    expect(joinedB).toBe(true);

    jobA.resolve();
  });
});
