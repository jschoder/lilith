# Emotion state is an 8-dim Plutchik vector, not PAD

Ticket 01's research recommended a PAD-based hybrid (3 continuous
dimensions + ALMA dynamics), since PAD natively supports magnitude and
ALMA's push/pull gives buildup/decay. We deviated: runtime state is
instead one independent scalar ([0,1]) per Plutchik primary emotion
(joy, trust, fear, surprise, sadness, disgust, anger, anticipation),
stored twice as a fast **Emotion** layer and a slow **Mood** layer
(ALMA's two-speed structure still applies, just per-dimension instead of
to a single 3D point).

The reason: per-character authoring needs independent buildup/decay
tuning per named emotion (e.g. "quick to anger, slow to trust"). A single
PAD point can't support that — anger and fear share the same Arousal
axis, so tuning one tunes both. A single blended PAD point also collapses
simultaneous mixed emotions (e.g. nervous excitement) into one averaged
position instead of representing them as coexisting.

Cost: a fully independent 8-vector can let opposite pairs (joy↔sadness,
trust↔disgust, fear↔anger, surprise↔anticipation) sit at maximum
simultaneously indefinitely, which real emotions don't do. Mitigated with
appraisal-time-only suppression — a stimulus to one member of a pair
dampens the other — rather than a continuous coupling term, to keep the
per-emotion dynamics otherwise independent.

Stimuli are produced by LLM-judged appraisal of each conversational turn
(not sentiment analysis or hardcoded event tags), output sparsely — only
the 1-3 emotions actually evoked, not all 8 every turn.
