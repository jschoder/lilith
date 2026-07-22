# tuning.ts is the single home for global tuning constants

Several tickets deferred exact constant values as open tuning tasks:
ticket 04's opposite-pair `suppression_fraction`, ADR-0005's compression
budget `floor`/`half_life`/`emotional_threshold`, and ticket 06's
retrieval weights/`recency_half_life`/`retrieval_token_budget`/
`min_retrieval_score`. Rather than let each live wherever its owning
module happens to sit, all of them are consolidated into one source file,
`tuning.ts`, as hardcoded, hand-editable values.

This is deliberately **not** env-var config. The project's "every env var
required, no fallbacks" rule (see map.md) targets deployment config — DB
paths, API keys, anything that varies per install. These constants aren't
that: they're model-behavior tuning, identical across every deployment,
and ADR-0002 already established the precedent of hand-tunable defaults
for the emotion system. Routing them through required env vars would force
every deployment to carry values that never actually vary.

The boundary for what belongs in `tuning.ts` versus per-character storage
is a litmus test, not a judgment call per constant: does it derive from a
character's Personality Point via ADR-0002's one-time creation-time
projection (Baseline Mood, per-emotion buildup/decay half-lives — these
stay per-character), or not (everything above — these go in `tuning.ts`).
See [ticket 06](../../.scratch/chatbot/issues/06-memory-retrieval-scoring.md).
