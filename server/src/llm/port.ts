import type { z } from "zod";

/**
 * The single seam every component talks through for LLM inference and
 * text embedding — no component is allowed to call Ollama (or any other
 * provider) directly. See ticket 16.
 */
export interface LlmPort {
  /** One LLM call constrained to return a value matching `schema`. An aborted `signal` should reject promptly rather than waiting for the network call to finish. */
  generateStructured<T>(args: {
    system: string;
    prompt: string;
    schema: z.ZodType<T>;
    signal?: AbortSignal;
  }): Promise<T>;
  /** Embeds a single piece of text into a vector. */
  embed(text: string): Promise<number[]>;
}
