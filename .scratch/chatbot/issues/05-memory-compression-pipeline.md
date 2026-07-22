# Memory compression pipeline

Type: grilling
Status: resolved

Blocked by: 02, 03, 14

## Question

The design calls for a less-compressed short-term memory and a more-
compressed long-term memory. Using the findings from
[ticket 02](02-turso-vector-search-research.md) (Turso vector capability)
and [ticket 03](03-ollama-embedding-models-research.md) (embedding model),
define concretely:

- What does "short-term" store — raw message text? embeddings only?
  both? how far back does it reach before eviction?
- What does "compression" mean when a memory moves from short-term to
  long-term — an LLM-generated summary? dropping raw text and keeping only
  the embedding + a short gist? something else?
- What triggers the transition (turn count? token budget? time elapsed?)?
- What's the resulting DB schema shape (tables/columns) for short-term vs.
  long-term storage within a single character's DB file?

This feeds [ticket 06](06-memory-retrieval-scoring.md) (retrieval scoring)
and [ticket 07](07-response-delivery.md) (streaming decision depends on
when this pipeline's side effects run relative to reply completion).

## Answer

**Atomic unit**: a single sent Message, not a user+character turn-pair —
matches real-person texting cadence, where one sender can fire off several
short messages before a reply.

**Storage shape**: one permanent `messages` table serves all three roles —
audit log (raw text kept forever, never deleted), Short-term Memory (a live
query over the uncompressed tail), and Long-term Memory (the same rows once
Compressed). No separate short-term table, no deletion step. See
[ADR-0003](../../docs/adr/0003-single-table-message-log-spans-short-and-long-term-memory.md).

```sql
CREATE TABLE messages (
  id                     INTEGER PRIMARY KEY,
  sender                 TEXT NOT NULL,        -- 'user' | 'character'
  text                   TEXT NOT NULL,        -- kept forever
  created_at             TIMESTAMP NOT NULL,
  emotion_vector         TEXT NOT NULL,        -- full 8-dim Emotion snapshot (JSON), audit/debug
  peak_emotion_intensity REAL NOT NULL,        -- max() of the vector above
  embedding              F32_BLOB(768),        -- NULL until Compressed
  compressed_at          TIMESTAMP,            -- NULL = still in the live short-term tail
  summary_id             INTEGER REFERENCES memory_summaries(id)
);

CREATE TABLE memory_summaries (
  id         INTEGER PRIMARY KEY,
  gist_text  TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL
);
```

No `character_id`/`conversation_id` column — per-character DB-file
isolation (already locked in per the map) makes the file itself the scope
boundary.

**What "Compression" means**: computing and attaching an `embedding`
(nomic-embed-text, per ticket 03) and `peak_emotion_intensity` to a Message
— it does not touch `text`. Long-term Memory is per-message, not
per-batch: each Compressed Message keeps its own embedding, and a Memory
Summary (LLM-written gist) is generated per compression batch as an
*additive* layer that cites its source Messages via `summary_id`, never
replacing them. Grounded in [ticket 14](research/14-human-memory-consolidation.md)'s
research into human memory consolidation (event-grain hippocampal encoding,
gist extracted later and additively) and the closest LLM-agent analog
(Generative Agents' per-event memory stream + cited reflections). See
[ADR-0004](../../docs/adr/0004-long-term-memory-is-per-message-not-per-batch.md).

**Compression trigger**: a single decaying effective token budget —
`effective_budget = max(floor, base_budget × decay(idle_time))`, same
exponential shape as ADR-0001's Mood decay — rather than separate
count/time/budget triggers. Whatever currently exceeds the effective
budget Compresses, oldest first, whether the overflow comes from idle time
shrinking the budget (a stale multi-week-old tail shouldn't replay in
full) or an active conversation filling the max budget (a long
uninterrupted chat continuously folds its trailing edge into Long-term
Memory rather than hitting a hard cutoff). Cumulative/peak
`peak_emotion_intensity` in the current short-term window is a secondary
trigger that can force early Compression under budget, mirroring
Generative Agents' cumulative-importance-triggered reflection. Exact
floor/half-life/emotional-threshold constants are an open tuning task, not
pinned here. See [ADR-0005](../../docs/adr/0005-compression-trigger-is-decaying-budget-plus-emotional-promotion.md).

**Downstream**: ticket 06 reads `embedding` for similarity search and
`peak_emotion_intensity` directly for salience-biased scoring (no extra
LLM call needed — it's a byproduct of ticket 04's appraisal step); ticket
07 needs to account for the compression trigger check running on every
incoming message, not just periodically.
