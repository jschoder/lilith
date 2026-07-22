# Goals are a persistent Drive plus dynamically-managed Minor Goals

Ticket 09 (and ticket 10, which references it) originally assumed a flat
list of hardcoded per-character goals. We split the concept in two instead.

Each character has exactly one **Drive**: a hardwired, author-time want
(e.g. "world domination") — a guiding star, not an achievable goal. It
never completes, carries no progress tracking, and is never mutated at
runtime; it lives in the character's config (ticket 10), not the DB. It's
injected into the prompt every turn, but framed as a background
disposition ("colors their perspective, doesn't announce itself every
line") rather than an active per-turn directive — solved through prompt
phrasing alone, deliberately not a suppression/relevance-gating mechanism.

The Drive dynamically spawns and retires a small, possibly-empty list of
**Minor Goals** — concrete, completable objectives (e.g. "learn the user's
name") — in reaction to the character's emotional development (see
[ADR-0001](0001-emotion-state-is-a-plutchik-vector-not-pad.md)). Both
directions are driven by the same mechanism: emotional development can
spawn a new Minor Goal or retire an existing one whose motivation faded.
A Minor Goal's fate is one of two distinct outcomes — **completed**
(content-based: the LLM judges the objective was actually achieved) or
**retired** (emotion-driven: motivation faded before completion) — tracked
as a status, not a continuous progress scalar, since status is enough for
everything that consumes it and a scalar would demand a harder, less
reliable LLM judgment every turn for no reader.

Considered and rejected: a single flat hardcoded goal list (can't
distinguish an unattainable identity-level want from concrete achievable
tasks without conflating their very different lifecycles); goals as
retrievable memories surfaced by similarity to the current turn (a Minor
Goal semantically unrelated to anything said so far would simply never
surface — a cold-start problem retrieval alone can't solve).

**Consequences**: Minor Goals need their own table, since they don't fit
`messages` or `memory_summaries`' shape (no sender, no embedding, no
conversational text-as-such):

```sql
CREATE TABLE minor_goals (
  id              INTEGER PRIMARY KEY,
  text            TEXT NOT NULL,
  status          TEXT NOT NULL,   -- 'active' | 'completed' | 'retired'
  spawn_intensity REAL NOT NULL,   -- emotional intensity at spawn; decays like Mood
  spawned_at      TIMESTAMP NOT NULL,
  ended_at        TIMESTAMP        -- NULL while active
);
```

Rows are never deleted, matching
[ADR-0003](0003-single-table-message-log-spans-short-and-long-term-memory.md)'s
ethos. A concurrent-active-goal cap (exact number deferred to `tuning.ts`,
[ADR-0007](0007-tuning-ts-is-the-single-home-for-global-tuning-constants.md))
is enforced by auto-retiring whichever active Minor Goal has decayed to
the lowest importance. Importance is just `spawn_intensity` decaying
exponentially over elapsed real time — the same lazy-decay shape as
ADR-0001's Mood, computed on the fly from `spawn_intensity`/`spawned_at`
with no persisted "current" column, since a Minor Goal's intensity is set
once at spawn and never re-boosted (unlike Mood, which is repeatedly
pushed/pulled and so needs a rolling "last updated" timestamp).
