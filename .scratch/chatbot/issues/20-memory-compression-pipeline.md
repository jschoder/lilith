# 20 — Long-term memory: compression pipeline

**What to build:** Long conversations stop growing the live prompt window unbounded — aging messages get Compressed (embedding + `peak_emotion_intensity` attached, raw text untouched) once a decaying token budget is exceeded, or early if cumulative emotional intensity in the short-term window crosses a threshold, with an additive per-batch Memory Summary and zero deletion.

**Blocked by:** 18

**Status:** ready-for-agent

- [ ] A `(idleTime, cumulativePeakIntensity) -> effectiveBudget/triggerDecision` function is independently testable against a real libSQL file with no LLM/tRPC involved.
- [ ] Compression attaches `nomic-embed-text` embeddings and `peak_emotion_intensity` to the oldest uncompressed messages once the live tail exceeds the current effective budget — `text` and all other columns are untouched.
- [ ] The effective budget decays with idle time using the same exponential shape as Mood decay, floored at a configured minimum.
- [ ] A window of unusually emotionally intense messages can trigger early Compression even while still under the token budget.
- [ ] Each Compression batch writes one additive `memory_summaries` row and links the batch's messages to it via `summary_id`; no existing row's `text` is ever deleted or nulled.
- [ ] Compression runs as part of the same post-reply background job introduced in ticket 18, on every incoming message.
- [ ] Budget/floor/threshold constants live in `tuning.ts`.
