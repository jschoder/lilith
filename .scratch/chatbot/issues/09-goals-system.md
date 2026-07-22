# Goals system

Type: grilling
Status: resolved

## Question

Each character has hardcoded goals. Define how they're represented and how
they actually influence the character's behavior:

- Are goals injected into the system prompt as text (simplest, but the LLM
  may not reliably act on them)?
- Or do they drive an explicit planning/scoring loop (e.g. candidate
  responses are generated and scored against goal progress before one is
  chosen — more control, more complexity/latency)?
- Can goals be satisfied/completed, or are they persistent drives (e.g.
  "be a supportive companion" vs. "learn the user's name")? Does goal
  *progress* get tracked and stored anywhere (interacts with
  [ticket 05](05-memory-compression-pipeline.md)'s schema if so)?
- Do goals interact with the emotion system (per
  [ticket 04](04-emotion-model-design.md)) — e.g. does goal
  frustration/progress produce emotional reactions?

## Answer

Split "goals" into two distinct concepts rather than one flat hardcoded
list. Full design:

**Drive**: exactly one per character, hardwired at character creation
(e.g. "world domination") — a guiding star, not an achievable goal. Never
completes, no progress tracking, never mutated at runtime; lives in the
character's config (ticket 10), not the DB. Injected into the prompt every
turn, but framed as a background disposition rather than an active
directive — solved through prompt phrasing alone, deliberately not a
suppression/relevance-gating mechanism (that idea was considered and
rejected — it adds a threshold to tune and a way to misfire, for a problem
the LLM already handles by reading the room, the same way it already
knows not to force "be a supportive companion" into an argument). See
[ADR-0011](../../../docs/adr/0011-goals-are-a-persistent-drive-plus-dynamic-minor-goals.md).

Character "self-identity" (e.g. "crazy scientist") is a separate concept
from Drive — that's personality/flavor and belongs to ticket 10's
character-description prompt fragment, not this system.

**Minor Goal**: a small, possibly-empty list of concrete, completable
objectives (e.g. "learn the user's name") that the Drive dynamically
spawns and retires in reaction to the character's emotional development
(ticket 04) — both directions driven by the same mechanism. Two distinct
end-states: **Completed** (content-based — the LLM judges the objective
was actually achieved) vs. **Retired** (emotion-driven — motivation faded,
or evicted to stay under the active-goal cap). Tracked as a status only,
not a continuous progress scalar — nothing downstream needs a number, and
a scalar would demand a harder, less reliable LLM judgment every turn for
no reader. Own DB table (doesn't fit `messages`/`memory_summaries`'
shape), rows never deleted:

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

A cap on concurrent active Minor Goals (exact number → `tuning.ts`, per
[ADR-0007](../../../docs/adr/0007-tuning-ts-is-the-single-home-for-global-tuning-constants.md))
is enforced by auto-retiring whichever active Minor Goal has decayed to
the lowest importance. Importance is just `spawn_intensity` decaying
exponentially over elapsed real time from `spawned_at` — same lazy-decay
shape as ADR-0001's Mood — computed on the fly, no persisted "current"
column needed, since intensity is set once at spawn and never re-boosted.

**Mechanism**: no explicit planning/scoring loop. The same per-turn
LLM-judged, sparse, structured-output call that already produces ticket
04's emotion Stimulus is extended to also judge Minor Goal
completion/retirement and possible new-goal spawning, and to react to a
completion/retirement with its own emotion Stimulus in the same breath —
one call covers both systems, consistent with this project's established
bias against extra per-turn LLM calls. No hardcoded mapping from goal
outcome to emotional reaction exists (same rejection of hardcoded
event/stimulus tables as ADR-0001) — completing an innocuous Minor Goal
and completing one spawned in service of a sinister Drive plausibly
warrant different reactions despite both being "completions," and only
contextual LLM judgment can tell them apart. See
[ADR-0012](../../../docs/adr/0012-goal-lifecycle-piggybacks-on-emotion-appraisal.md).

**Downstream**: ticket 10 needs to decide whether a newly-created character
starts with zero Minor Goals or an authored initial set. Ticket 05's
`messages` schema is *not* touched by this system — Minor Goals get their
own table instead.
