# Burst messages cancel-and-restart in-flight generation

Messages are deliberately atomic (see [ADR-0003](0003-single-table-message-log-spans-short-and-long-term-memory.md)'s
Message definition) to support a rapid-fire sequence from one sender
before a reply — real texting cadence, not an edge case. That means a new
user message can arrive while the character's reply to a previous message
is still generating. Candidates were: queue the new message and generate a
second reply afterward; debounce/collect messages for a short window
before starting generation at all; or cancel the in-flight generation and
restart it with the full updated context.

We chose cancel-and-restart, capped to a bounded number of restarts (an
implementation-level constant, home in [`tuning.ts`](0007-tuning-ts-is-the-single-home-for-global-tuning-constants.md))
to prevent livelock if a user never stops typing. Queueing was rejected
because it can produce a first reply that's incoherent with a fast
follow-up (e.g. "hey" / "wait nvm don't answer that" — the first reply
would still address "hey"). A fixed debounce window was rejected because
it taxes every single-message exchange — the common case — with added
latency before generation even starts, purely to protect against the less
common burst case. Cancel-and-restart adds no latency to the common case
(generation starts immediately) and always produces one coherent reply
per settled burst; the wasted generation compute on a cancel is a
non-issue running against local Ollama rather than a metered API.
