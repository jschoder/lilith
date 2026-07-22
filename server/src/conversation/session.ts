import { GENERATION_RESTART_CAP } from "../tuning.js";

interface Attempt<T> {
  controller: AbortController;
  promise: Promise<T>;
}

/**
 * Cancel-and-restart burst handling for a single Character's reply
 * generation (ADR-0009): a new message before the current attempt settles
 * aborts it and restarts with fresh context, up to `restartCap` times —
 * every caller across the burst resolves to the same final reply. Past
 * the cap, the in-flight attempt is left to finish so a reply is always
 * eventually delivered instead of livelocking.
 */
class GenerationSession<T> {
  private version = 0;
  private restartCount = 0;
  private current: Attempt<T> | null = null;

  constructor(private readonly restartCap: number) {}

  request(generate: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (this.current === null) {
      this.current = this.start(generate);
    } else if (this.restartCount < this.restartCap) {
      this.restartCount += 1;
      this.current.controller.abort();
      this.current = this.start(generate);
    }
    return this.current.promise;
  }

  private start(generate: (signal: AbortSignal) => Promise<T>): Attempt<T> {
    this.version += 1;
    const myVersion = this.version;
    const controller = new AbortController();

    const promise = (async () => {
      try {
        const result = await generate(controller.signal);
        if (myVersion !== this.version) {
          // Superseded by a restart while running — defer to whatever is current now.
          return this.current!.promise;
        }
        this.current = null;
        this.restartCount = 0;
        return result;
      } catch (err) {
        if (myVersion !== this.version) {
          return this.current!.promise;
        }
        this.current = null;
        this.restartCount = 0;
        throw err;
      }
    })();

    return { controller, promise };
  }
}

export class ConversationManager<T> {
  private readonly sessions = new Map<string, GenerationSession<T>>();

  constructor(private readonly restartCap: number = GENERATION_RESTART_CAP) {}

  requestReply(characterId: string, generate: (signal: AbortSignal) => Promise<T>): Promise<T> {
    let session = this.sessions.get(characterId);
    if (!session) {
      session = new GenerationSession<T>(this.restartCap);
      this.sessions.set(characterId, session);
    }
    return session.request(generate);
  }
}
