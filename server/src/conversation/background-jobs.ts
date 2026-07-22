/**
 * Tracks each Character's currently in-flight post-reply background job
 * (ticket 18's Appraisal today; ticket 20's compression-trigger check joins
 * the same slot later) so the *next* turn can wait for it before starting,
 * per ADR-0008 — guarantees a serialized read-modify-write against
 * persisted Emotion/Mood state instead of two turns racing to update it.
 */
export class BackgroundJobs {
  private readonly jobs = new Map<string, Promise<void>>();

  /** Waits for `characterId`'s previously-tracked job, if any. Never rejects — a failed background job degrades that turn's side effects but must never block future turns. */
  async join(characterId: string): Promise<void> {
    await this.jobs.get(characterId);
  }

  /** Tracks `job`, fire-and-forget, as the current in-flight background work for `characterId`. */
  track(characterId: string, job: Promise<void>): void {
    this.jobs.set(
      characterId,
      job.catch((err) => {
        console.error(`Background job failed for character ${characterId}:`, err);
      }),
    );
  }
}
