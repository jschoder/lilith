# Memory retrieval scoring

Type: grilling
Status: resolved

Blocked by: 04, 05

## Question

Define a single retrieval scoring formula (or ranked pipeline) that
combines:

- vector similarity (semantic relevance to the current conversation turn)
- recency bias (more recent memories favored)
- emotional-salience bias (memories tied to strong emotional reactions,
  per [ticket 04](04-emotion-model-design.md)'s state representation,
  favored)

Concretely: how are these combined (weighted sum? multi-stage
filter-then-rank? something else)? Are the weights fixed or configurable?
Does the formula differ between short-term and long-term memory (per
[ticket 05](05-memory-compression-pipeline.md)'s schema)? How many memories
get pulled into context per turn, and is there a token budget constraint?

## Answer

**Scope**: the formula applies only to Long-term Memory. Short-term Memory
has no scoring or ranking at all — per ADR-0003 it's injected unconditionally
up to ADR-0005's decaying token budget. A formula that also selected *which*
short-term Messages to keep (e.g. de-prioritizing a topically-closed side
conversation ahead of its natural oldest-first turn) was raised and
deliberately deferred: it would require an embedding before Compression,
blurring ADR-0004's Compression boundary, for a bounded benefit (wasted
token budget, not lost retrieval quality, since a topically dead-end memory
already won't win the similarity term below).

**Combination**: a single-stage weighted sum, computed as one SQL `ORDER BY`
expression over the unindexed full scan ticket 02 already established —
no multi-stage filter-then-rank, no hard pre-blend similarity floor:

```sql
SELECT *,
       (1 - vector_distance_cos(embedding, :query_embedding) / 2) AS similarity,
       POWER(0.5, (julianday('now') - julianday(created_at)) * 24 / :recency_half_life_hours) AS recency_factor
FROM messages
WHERE embedding IS NOT NULL
ORDER BY (:w_sim * similarity
        + :w_rec * recency_factor
        + :w_sal * peak_emotion_intensity) DESC
LIMIT :max_candidates
```

Both `similarity` (`vector_distance_cos` returns cosine *distance* in
`[0,2]`, corrected here to a `[0,1]` similarity) and `recency_factor`
(exponential half-life decay off `created_at`, same shape as ADR-0001's
Mood decay and ADR-0005's budget decay, own `recency_half_life` constant)
are normalized to `[0,1]` to match `peak_emotion_intensity`'s native range.
`w_sim + w_rec + w_sal = 1`, so the blended score stays `[0,1]` and each
weight reads as a literal proportion of the ranking.

Rejected a hard pre-blend similarity floor deliberately: a recent,
emotionally intense memory can outrank a more topically similar but old,
flat one. That's treated as a feature, not a bug — it mimics the way a
vivid emotional memory intrudes on an only-loosely-related conversation.
See [ADR-0006](../../../docs/adr/0006-retrieval-scoring-is-a-single-stage-weighted-sum.md).

**Budget**: token-budget-bound, not fixed-K. Candidates are walked in
descending blended-score order and greedily added to the prompt until a
flat `retrieval_token_budget` constant is exhausted, or the next
candidate's blended score falls below `min_retrieval_score` (guards
against padding in irrelevant memories just because budget remains).
`retrieval_token_budget` is independent of ADR-0005's `short_term`
budget — coupling the two (e.g. a shared pool split by percentage) was
considered and rejected: they serve different purposes, and the *total*
prompt ceiling (short-term + retrieved long-term + system/character prompt
+ generation headroom) isn't owned by any ticket yet (see map.md's Not yet
specified).

**Memory Summaries**: out of scope for retrieval. The formula only ranks
`messages` rows with a non-null `embedding`; `memory_summaries` has no
embedding column and, per ADR-0004, exists purely as an additive,
citation-only layer. A retrieved Message's linked summary is never
attached or surfaced by this formula.

**Weights are global, not per-character.** Litmus test: every
per-character-tunable constant established so far (Baseline Mood,
per-emotion buildup/decay half-lives) traces back through ADR-0002's
one-time Personality Point projection at character creation. Nothing
projects a "retrieval personality," so `w_sim`/`w_rec`/`w_sal`/
`recency_half_life`/`retrieval_token_budget`/`min_retrieval_score` have no
per-character authoring path and stay global.

**Config**: all six constants above, plus every previously-deferred global
tuning constant (ticket 04's `suppression_fraction`; ADR-0005's budget
`floor`/`half_life`/`emotional_threshold`), are consolidated into one new
`tuning.ts` — hardcoded, hand-editable source values, not env vars. The
map's "every env var required, no fallbacks" rule is reserved for
deployment config (DB paths, API keys); these are model-behavior constants,
identical across every deployment. See
[ADR-0007](../../../docs/adr/0007-tuning-ts-is-the-single-home-for-global-tuning-constants.md).
