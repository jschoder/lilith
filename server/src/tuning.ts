/**
 * Single home for global, hand-tunable model-behavior constants — never
 * env vars, per ADR-0007. Deployment config (paths, hosts, keys) lives in
 * env.ts instead.
 */

/** Bounds cancel-and-restart burst handling (ADR-0009): after this many restarts, an in-flight generation is left to finish rather than cancelled again. */
export const GENERATION_RESTART_CAP = 3;

/**
 * Opposite-pair suppression fraction (ticket 04/18): a Stimulus to one
 * member of an opposite pair (joy/sadness, trust/disgust, fear/anger,
 * surprise/anticipation) dampens the other by `intensity * this fraction`.
 * Placeholder default — ticket 04 flags this as an open calibration task
 * (a ~1M-scenario simulation sweep checking for no-op suppression and
 * runaway oscillation), not yet run.
 */
export const EMOTION_SUPPRESSION_FRACTION = 0.3;
