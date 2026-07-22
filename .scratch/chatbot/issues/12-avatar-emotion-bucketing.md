# Avatar emotion bucketing

Type: grilling
Status: resolved

Blocked by: 04

## Question

Avatars are a pre-made image set (not generative), one per emotional
state. Using [ticket 04](04-emotion-model-design.md)'s emotion state
representation, define:

- How many discrete image buckets are needed, and how is a continuous/
  multi-dimensional emotion state mapped down to "pick the closest bucket"?
  (E.g. dominant-emotion-plus-intensity-tier? nearest-neighbor in emotion
  space against each bucket's defining coordinates?)
- Does intensity get its own visual tier (e.g. "mildly happy" vs. "very
  happy" as different images), or is intensity ignored for image selection
  and only the dominant emotion category matters?
- What's the exact bucket list this produces — this is the checklist
  [ticket 13](13-source-avatar-images.md) needs to go source/produce
  images against.

## Answer

Reads the **Mood** layer (per ticket 04's downstream note), not Emotion.

**Dominant emotion**: whichever of the 8 Mood components has the highest
*raw* value right now — not a deviation from Baseline Mood, and no
separate neutral bucket. A naturally cheerful character sitting at
Baseline Mood joy=0.6 shows a "joy" bucket at rest by design — Baseline
Mood is personality bleeding into the avatar, which is the point of it.
Plutchik's own low-tier nuance names (serenity, acceptance, apprehension,
etc.) already read as mild/calm expressions, so the low tier of whatever's
dominant functions as the resting look without a ninth per-character
neutral image.

**Tiebreak** (top Mood components within an epsilon, e.g. 0.02 — needed
because each dimension decays/builds independently and can land near-equal
by coincidence): compare Baseline Mood for just the tied components,
higher wins — this makes ties resolve "in character" (a surly character's
anger/fear tie shows anger) rather than identically for every character.
If Baseline Mood also ties (degenerate case): fixed fallback order `fear >
anger > disgust > sadness > surprise > anticipation > trust > joy`,
reasoned from negativity-bias literature (Baumeister, Bratslavsky,
Finkenauer & Vohs 2001, "Bad Is Stronger Than Good," *Review of General
Psychology*) plus fight/flight/freeze urgency — not a direct citation of
an existing cross-emotion ranking, since none was found.

**Intensity tier**: the dominant component's raw value binned into **3**
even tiers — low `[0, 0.33)`, mid `[0.33, 0.66)`, high `[0.66, 1.0]`.
3 tiers matches Plutchik's own foundational structure (Postulate 10 plus
the standard 3-named-levels-per-primary wheel diagram) rather than
inventing a finer split — 5 tiers was considered and rejected: no
research-backed names for the extra levels, narrower bands mean more
frequent boundary-crossing flicker as Mood decays continuously, and
static art may not reliably render 5 distinguishable expressions per
emotion anyway. Tier cutoffs are global, not derived from a character's
Personality Point, so per ADR-0007's litmus test they belong in
`tuning.ts`, hand-tunable like the project's other invented constants.

**Bucket** = (dominant emotion, tier) — a fixed, universal 24-slot
taxonomy (same list for every character; only the art per slot is
per-character, matching how ticket 13 already phrases its own scope).
Named after Plutchik's graded nuance vocabulary rather than generic
`{emotion}-{tier}` labels, so ticket 13's artist/generator has a concrete
word to brief against:

| Primary | Low | Mid | High |
|---|---|---|---|
| Joy | serenity | joy | ecstasy |
| Trust | acceptance | trust | admiration |
| Fear | apprehension | fear | terror |
| Surprise | distraction | surprise | amazement |
| Sadness | pensiveness | sadness | grief |
| Disgust | boredom | disgust | loathing |
| Anger | annoyance | anger | rage |
| Anticipation | interest | anticipation | vigilance |

See [ADR-0015](../../../docs/adr/0015-avatar-bucket-is-raw-value-dominant-emotion-x-plutchik-3-tier.md).
