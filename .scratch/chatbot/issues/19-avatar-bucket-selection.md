# 19 — Avatar: bucket selection & live SSE push

**What to build:** The Character's avatar image now visibly tracks its mood — after each turn's background job, the current Mood vector picks one of the 24 pre-made buckets (dominant emotion × intensity tier) and pushes it to the client over a live channel, so the avatar changes shortly after each reply with no extra user action.

**Blocked by:** 18

**Status:** ready-for-agent

- [ ] Bucket selection is a pure function `(moodVector, baselineMood) -> bucket` covering dominant-emotion selection (raw value, no baseline-relative deviation), tiebreaking (baseline comparison, then fixed fallback order), and 3-tier intensity binning.
- [ ] A dedicated SSE channel (separate from tRPC) pushes `{emotion, avatarBucket}` after the same background job that runs Appraisal/Compression, so the avatar update follows shortly after the reply.
- [ ] The chat UI subscribes to that channel and swaps the displayed avatar image to the matching file in the existing default 24-image set.
- [ ] A newly created Character's initial avatar reflects its authored Baseline Mood before any conversation happens (e.g. a naturally anxious Character shows a low/mid fear-family bucket at rest, not a neutral image).
- [ ] Tier cutoffs are the shared `tuning.ts` constants, not re-declared locally.
