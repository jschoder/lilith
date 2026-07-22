# Emotion model design

Type: grilling
Status: resolved

Blocked by: 01

## Question

Using the survey from [ticket 01](01-emotion-simulation-models-research.md),
pick a specific emotion model (or a deliberate hybrid) and define concrete
mechanics:

- What is the emotional state representation (a fixed set of discrete
  emotions with intensities? a continuous space like PAD? both)?
- Buildup rule: how do repeated small stimuli accumulate, and how does a
  single extreme stimulus spike an emotion immediately?
- Decay rule: confirmed to be slower than buildup — what's the actual decay
  function/half-life, and does it differ per emotion or by intensity?
- How are differing *magnitudes* of the same emotion type handled distinctly
  (not just "angry" as a boolean, but "mildly annoyed" vs. "furious")?
- What triggers a stimulus in the first place (message sentiment analysis?
  LLM-judged appraisal of the conversation turn? explicit event tags)?

This decision directly feeds [ticket 12](12-avatar-emotion-bucketing.md)
(mapping this state to avatar images) and
[ticket 06](06-memory-retrieval-scoring.md) (emotional-salience bias in
retrieval).

## Answer

Deviated from ticket 01's PAD-hybrid recommendation. Full design:

**State representation**: no PAD at runtime. One scalar per Plutchik
primary (joy, trust, fear, surprise, sadness, disgust, anger,
anticipation), each in [0, 1], stored twice — a fast **Emotion** layer and
a slow **Mood** layer (ALMA's two-speed structure, applied per-dimension
instead of to a single PAD point). See ADR-0001.

**Character creation**: personality authored once as a PAD point, projected
through a canonical Plutchik↔PAD coordinate table into the character's
Baseline Mood vector and default per-emotion buildup-gain/decay-half-life
constants (hand-tunable afterward). PAD is discarded after this — never
touched again at runtime. See ADR-0002.

**Buildup**: ALMA's pull-and-push, per emotion-dimension independently — a
stimulus sets/raises the Emotion-layer value; the Mood-layer value for that
dimension is pulled toward it (if approaching) or pushed further past it,
saturating at 1.0 (if already reached). This is what lets repeated small
stimuli escalate Mood past what any single stimulus alone justified.

**Decay**: exponential, computed lazily at each turn from elapsed real time
since last update (`value *= 0.5^(elapsed/half_life)`), independent
half-life per emotion per layer per character. Defaults: ~5min
(Emotion layer), ~6hr (Mood layer) — rescaled from ALMA's literal 20s/10min
constants, which assume continuous real-time ticking rather than a
turn-based chat medium.

**Cross-emotion interaction**: opposite-pair suppression only (joy↔sadness,
trust↔disgust, fear↔anger, surprise↔anticipation), applied at appraisal
time — a stimulus to one member dampens the other by
`suppression_fraction × stimulus_intensity`. **Open implementation task**:
`suppression_fraction` has no fixed value yet — calibrate via a ~1M-scenario
simulation sweep when implementing, checking for both no-op suppression and
runaway oscillation.

**Stimulus trigger**: LLM-judged appraisal of each conversational turn
(ideally piggybacked on the existing reply-generation call), sparse output
— only the 1-3 emotions actually evoked, not all 8 every turn. Rejected
sentiment analysis (too shallow — misses context like "I got fired today
lol") and explicit event tags (can't cover open-ended chat content).

**Magnitude**: native — "mildly annoyed" vs. "furious" is anger=0.2 vs.
anger=0.9 on the same scalar.

**Downstream**: ticket 12 reads dominant-emotion + intensity-tier directly
off the Mood vector; ticket 06 reads emotional salience directly as the
peak Emotion-vector component(s) at the time of the memory.
