# Compression trigger: a single decaying token budget, plus emotional promotion

Candidates for triggering Compression were a fixed message-count window, a
fixed token budget, or time elapsed. A flat trigger doesn't serve both
cases at once: a long, continuously active conversation needs a ceiling so
the prompt doesn't grow unbounded, while a conversation resumed after a
multi-week gap shouldn't replay a full raw window of now-stale Messages.
We unified both into one continuous rule: `effective_budget = max(floor,
base_budget × decay(idle_time))`, using the same exponential-decay shape as
[ADR-0001](0001-emotion-state-is-a-plutchik-vector-not-pad.md)'s Mood decay.
Whatever exceeds the current effective budget Compresses, oldest first —
whether the overflow comes from idle decay shrinking the budget or from an
active conversation filling it. Cumulative/peak Peak Emotion Intensity in
the current Short-term window is a secondary trigger that can force early
Compression even under budget, mirroring Generative Agents'
reflection-on-cumulative-importance mechanism (see
[ticket 14](../../.scratch/chatbot/research/14-human-memory-consolidation.md)).
Exact floor/half-life/emotional-threshold constants are left as an
open implementation/tuning task, same treatment ADR-0001 gave
`suppression_fraction`.
