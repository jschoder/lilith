# 18 — Emotion/Mood engine wired into conversation

**What to build:** Every conversational turn now visibly changes the Character — reply generation is followed by an LLM-judged Appraisal that updates a fast Emotion layer and a slow Mood layer per Plutchik primary, with buildup, decay, and opposite-pair suppression. Each stored message's `emotion_vector`/`peak_emotion_intensity` reflect real Appraisal output instead of placeholders.

**Blocked by:** 17

**Status:** ready-for-agent

- [x] Emotion/Mood state update is a pure function `(state, elapsedTime, stimulus) -> nextState`, independently testable without the LLM or DB.
- [x] A sufficiently intense single Stimulus spikes the Emotion layer immediately; the Mood layer moves toward it more slowly.
- [x] Elapsed real time decays both layers exponentially per-dimension, per-Character, using that Character's own buildup/decay constants from creation.
- [x] A Stimulus to one member of an opposite pair (joy/sadness, trust/disgust, fear/anger, surprise/anticipation) dampens the other by the configured suppression fraction.
- [x] After a reply is delivered to the client, a background job runs one sparse LLM Appraisal call against the turn and applies its Stimulus to persisted Emotion/Mood state before the next turn's generation begins.
- [x] Every new row in `messages` carries the real `emotion_vector` snapshot and `peak_emotion_intensity` from that turn's Appraisal, not a zero/placeholder vector.
- [x] All new constants (suppression fraction, decay half-lives, etc.) live in the shared `tuning.ts`, not hardcoded inline or per-call.

## Comments

Implemented. `server/src/emotion/dynamics.ts` holds the pure
`advanceEmotionMood(state, elapsedMs, stimulus, constants) -> nextState`:
per-dimension exponential decay (`value *= 0.5^(elapsed/half_life)`) using
each primary's own `emotionHalfLifeMinutes`/`moodHalfLifeHours`, then
opposite-pair suppression (`OPPOSITE_PRIMARY` table, new in
`domain/plutchik.ts`) computed from the decayed baseline so pair order
never matters, then ALMA-style buildup: the Emotion layer spikes by
`intensity * buildupGain`, and the Mood layer is pulled toward the spike
if still approaching it or pushed further past it (saturating at 1) if
already caught up — the mechanism that lets repeated stimuli escalate
Mood past what one stimulus alone would justify. `EMOTION_SUPPRESSION_FRACTION`
(placeholder `0.3`, pending ticket 04's calibration sweep) lives in
`tuning.ts` per ADR-0007.

`server/src/emotion/appraisal.ts` runs one sparse LLM `generateStructured`
call per turn against a schema of 8 optional `[0,1]` fields (one per
Plutchik primary) — sparse by construction since every field is optional,
matching ADR-0001's "1-3 emotions, not all 8" framing.

Persisted state lives in a new `emotion_state` singleton-row table
(`server/src/emotion/store.ts`), created and zero-seeded alongside
`messages`/`minor_goals` in `writeCharacterDirectory`. Both layers start
at zero (not Baseline Mood) — a fresh Character's avatar tie-break still
resolves to its personality-aligned emotion via ticket 12's
Baseline-Mood tie-break, without needing a non-zero runtime seed.

`server/src/conversation/appraise.ts` orchestrates one turn's Appraisal:
read persisted state → compute elapsed time since `updated_at` → advance
→ persist → snapshot the resulting Emotion vector and its `max()` onto
*both* of the turn's new message rows (user + character), since Appraisal
judges the turn as a whole per ADR-0001, not each message independently.

Wired into `router.ts` via a new `BackgroundJobs` tracker
(`conversation/background-jobs.ts`): `sendMessage` fires Appraisal
fire-and-forget after returning the reply (never blocking the current
turn), and joins the *previous* turn's tracked job before starting the
next one — satisfying ADR-0008's "next turn's generation blocks/joins on
that job if still in flight" guarantee and preventing two turns from
racing to read-modify-write `emotion_state`. A failed Appraisal is caught
and logged, not rethrown, so one bad LLM call can't wedge all future
turns.

Not done here, deliberately: reply generation (`conversation/generate.ts`)
still doesn't read Emotion/Mood into its prompt. ADR-0008 guarantees the
state is *current* by the time the next turn starts, but nothing in this
ticket's checklist asks generation to *consume* it yet — that's left for
whichever later ticket needs mood-conditioned replies (goals/ticket 22 is
the likely candidate, per its "real Emotion/Mood/memory context to react
to" framing).

38 new/updated tests across `emotion/dynamics.test.ts`,
`emotion/store.test.ts`, `emotion/appraisal.test.ts`,
`conversation/appraise.test.ts`, `conversation/background-jobs.test.ts`,
plus updates to `character/store.test.ts`, `conversation/messages.test.ts`,
and `router.test.ts` (an end-to-end test sends two turns in a row and
confirms the first turn's messages carry real, matching, non-zero
`emotion_vector`/`peak_emotion_intensity` by the time the second call
resolves). Full suite: 68 passed, typecheck clean in both `server` and
`web`.
