# Avatar bucket is raw-value dominant emotion × Plutchik 3-tier intensity

Ticket 12 needed to map the 8-dimensional Mood vector down to "pick one
pre-made avatar image." Two axes were genuinely up for grabs and hard to
reverse once ticket 13 commissions art against the result.

**Dominance is measured on Mood's raw value, not deviation from Baseline
Mood.** A character's Baseline Mood is personality expressed as a resting
point (ADR-0002); measuring dominance against it directly means a
naturally cheerful character shows "joy" at rest and a naturally anxious
one shows "fear" at rest, by design, rather than requiring a separate
neutral-state image per character. The alternative (baseline-relative
deviation) would need an explicit ninth neutral bucket and would suppress
exactly the personality-bleed effect Baseline Mood exists to produce.

**Intensity is 3 tiers (low/mid/high), not more.** This matches Plutchik's
own foundational structure (Postulate 10, and the standard 3-named-level
wheel diagram — e.g. serenity/joy/ecstasy) rather than inventing finer
granularity. 5 tiers was considered and rejected: no source-backed names
for the extra levels, narrower bins mean more frequent boundary-crossing
as Mood decays continuously, and static pre-made art may not render 5
distinguishable expressions per emotion legibly anyway. Tier cutoffs
(even thirds, `[0, .33) / [.33, .66) / [.66, 1.0]`) are global rather than
per-character, so they live in `tuning.ts` per ADR-0007's litmus test.

**Ties break via Baseline Mood, then a fixed fallback order.** When the
top Mood components land within an epsilon of each other, the tie is
broken by comparing *those* components' Baseline Mood values (computed on
the fly, not precomputed/stored) rather than a universal fixed order —
this keeps ties resolving "in character" instead of identically for every
character. Only if Baseline Mood also ties does a hardcoded fallback order
(`fear > anger > disgust > sadness > surprise > anticipation > trust >
joy`, reasoned from negativity-bias literature) apply, as a last resort
for a case expected to almost never fire.

This produces a fixed, universal 24-slot bucket taxonomy (8 emotions × 3
tiers), named with Plutchik's graded nuance vocabulary — the same 24 slots
for every character; only the art filling them is per-character. See
[ticket 12](../../.scratch/chatbot/issues/12-avatar-emotion-bucketing.md).
