/**
 * Single home for global, hand-tunable model-behavior constants — never
 * env vars, per ADR-0007. Deployment config (paths, hosts, keys) lives in
 * env.ts instead.
 */

/** Bounds cancel-and-restart burst handling (ADR-0009): after this many restarts, an in-flight generation is left to finish rather than cancelled again. */
export const GENERATION_RESTART_CAP = 3;
