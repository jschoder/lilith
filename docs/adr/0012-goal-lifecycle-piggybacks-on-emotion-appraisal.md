# Goal-lifecycle judgment piggybacks on emotion appraisal; no scoring loop

Ticket 09 posed a choice between plain prompt-injection and an explicit
planning/scoring loop (generate candidate responses, score each against
goal progress, pick one). We rejected the scoring loop — it roughly
doubles per-turn latency and complexity for a companion-chat product where
goal adherence isn't safety-critical, and this project has already
established a strong bias against extra per-turn LLM calls
([ADR-0001](0001-emotion-state-is-a-plutchik-vector-not-pad.md)'s appraisal
is explicitly piggybacked on the reply-generation call for the same
reason).

Instead, the same per-turn LLM call that produces ADR-0001's emotion
Stimulus is extended to also judge Minor Goal completion/retirement and
possible new-goal spawning (see
[ADR-0011](0011-goals-are-a-persistent-drive-plus-dynamic-minor-goals.md)),
and to react to a completion/retirement with its own emotion Stimulus in
the same breath. One sparse, LLM-judged, structured-output call per turn
covers both systems. No hardcoded mapping exists from goal outcome to
emotional reaction, consistent with ADR-0001's rejection of a hardcoded
stimulus/event table — completing an innocuous Minor Goal and completing
one spawned in service of a sinister Drive plausibly warrant different
reactions despite both being "completions," and only contextual LLM
judgment can tell them apart.
