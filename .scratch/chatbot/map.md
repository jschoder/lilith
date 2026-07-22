# AI companion chatbot — wayfinder map

## Destination

A build-ready spec for a multi-user AI companion chatbot: Ollama-served LLM,
Node/TS backend, React/TS frontend, Turso/libSQL with one DB file per
(user, character), persistent short-/long-term memory with vector retrieval,
a simulated emotion system driving pre-made avatar art, and hardcoded
per-character goals. The map is done when every open decision below has an
answer and nothing is left to resolve before an agent can implement from the
spec alone.

## Notes

- Domain: new project, no existing CONTEXT.md/ADRs — `/domain-modeling` will
  create them lazily as terms get pinned down (e.g. "short-term memory",
  "emotion buckets", "goal").
- Config: every env var is required; missing = crash on boot. No fallbacks,
  anywhere, ever. Bake this into every ticket that touches config.
- Per-character DB-file isolation is locked in; don't relitigate whether to
  use it, only how it composes with multi-user ([Multi-user auth & per-(user, character) DB provisioning](issues/11-multi-user-auth-db-provisioning.md)).
- Avatars are a pre-made image set, not generative; scope is "map emotion
  state to the closest pre-made image," not "render new art."
- Use `/research` for anything requiring outside knowledge (library/API
  capabilities, established models). Use `/grilling` + `/domain-modeling`
  for design decisions. Use `/prototype` if a decay curve or bucket-picking
  UI needs to be seen to be judged.

## Decisions so far

- Emotion-model research done: no single established model (PAD, OCC,
  Plutchik, Sims motives) natively satisfies all 4 required mechanics
  (buildup, spike, slow decay, magnitude). Recommended direction is a
  hybrid — PAD's continuous state space + ALMA's two-speed emotion/mood
  dynamics + Plutchik's intensity-bucketing for avatar mapping. See
  [ticket 01](issues/01-emotion-simulation-models-research.md) and full
  findings at [research/01-emotion-simulation-models.md](research/01-emotion-simulation-models.md).
- Ollama embedding-model research done: `nomic-embed-text` (768-dim,
  Apache-2.0) recommended as default for memory embedding, with
  `mxbai-embed-large` (1024-dim) as a quality-upgrade path and `all-minilm`
  (384-dim) as a hardware-constrained fallback. All three fit trivially
  within Turso's `F32_BLOB` 65,536-dim ceiling from ticket 02 — dimension is
  not a differentiator. See [ticket 03](issues/03-ollama-embedding-models-research.md)
  and full findings at [research/03-ollama-embedding-models.md](research/03-ollama-embedding-models.md).
- Turso/libSQL vector-search research done: libSQL (the mature C fork, not
  the beta Rust "Turso Database" rewrite) has native vector search —
  `F32_BLOB(D)` columns, `vector_distance_cos`/`_l2`/`_dot`, and a DiskANN-
  based ANN index (`libsql_vector_idx` + `vector_top_k`) — but the ANN index
  is built for datasets much larger than a per-character file and inflates
  on-disk size 10–50x at this project's scale. Recommended direction is
  `F32_BLOB` storage with a plain unindexed `ORDER BY vector_distance_cos(...)
  LIMIT k` scan (exact, fast enough per Turso's own ~10k-vector guidance),
  skipping `libsql_vector_idx` unless later profiling shows it's needed. See
  [ticket 02](issues/02-turso-vector-search-research.md) and full findings at
  [research/02-turso-vector-search.md](research/02-turso-vector-search.md).
- Emotion model design done: deviated from ticket 01's PAD-hybrid
  recommendation. Runtime state is a pure 8-dim vector (one scalar per
  Plutchik primary, [0,1]), stored twice as a fast Emotion layer and a slow
  Mood layer (ALMA two-speed dynamics, per-dimension). PAD is used only
  once, at character creation, to project a Baseline Mood and default
  per-emotion buildup/decay constants from an authored personality point —
  never touched at runtime. LLM-judged sparse appraisal is the stimulus
  trigger. Opposite-pair suppression fraction is an open implementation
  task (calibrate via ~1M-scenario simulation sweep). See
  [ticket 04](issues/04-emotion-model-design.md), [ADR-0001](../../docs/adr/0001-emotion-state-is-a-plutchik-vector-not-pad.md),
  [ADR-0002](../../docs/adr/0002-pad-authored-personality-seeds-character-creation-only.md).
- Memory compression pipeline design done: a single permanent `messages`
  table serves as audit log, Short-term Memory (live query over its
  uncompressed tail), and Long-term Memory (same rows once Compressed) —
  no separate tables, raw text never deleted. Atomic unit is a single
  Message, not a turn-pair. Long-term storage is per-message (own
  embedding), not per-batch, with an additive Memory Summary layer citing
  sources — grounded in new research (human memory consolidation +
  Generative Agents' architecture) rather than picked for convenience.
  Compression trigger is a single decaying token budget (unifying
  idle-time and active-conversation overflow into one formula) plus a
  secondary emotional-intensity promotion trigger. See
  [ticket 05](issues/05-memory-compression-pipeline.md),
  [ticket 14](issues/14-human-memory-consolidation-research.md),
  [ADR-0003](../../docs/adr/0003-single-table-message-log-spans-short-and-long-term-memory.md),
  [ADR-0004](../../docs/adr/0004-long-term-memory-is-per-message-not-per-batch.md),
  [ADR-0005](../../docs/adr/0005-compression-trigger-is-decaying-budget-plus-emotional-promotion.md).
- Memory retrieval scoring design done: Long-term Memory only (Short-term
  stays unconditional, per ADR-0003) is ranked by a single-stage weighted
  sum of vector similarity, recency (exponential half-life off
  `created_at`, same shape as ADR-0001/ADR-0005), and Peak Emotion
  Intensity — no pre-blend similarity floor, so a recent/emotionally
  intense memory can outrank a topically closer but flat one. Retrieval
  fills a flat token budget greedily in ranked order, gated by a minimum
  blended-score cutoff. Memory Summaries stay out of retrieval entirely
  (no embedding column, citation-only per ADR-0004). All resulting
  constants, plus previously-deferred ones from tickets 04/05, are
  consolidated into one new `tuning.ts` (hardcoded, not env vars) —
  distinguished from per-character personality-derived constants by
  whether they trace through ADR-0002's creation-time projection. See
  [ticket 06](issues/06-memory-retrieval-scoring.md),
  [ADR-0006](../../docs/adr/0006-retrieval-scoring-is-a-single-stage-weighted-sum.md),
  [ADR-0007](../../docs/adr/0007-tuning-ts-is-the-single-home-for-global-tuning-constants.md).
- Response delivery design done: replies are delivered as a single
  complete Message, not token-streamed — matches the Message glossary
  term's "real-person texting cadence" framing over a live-transcription
  feel, and local Ollama latency makes streaming's responsiveness edge
  marginal. Appraisal and the compression-trigger-check/Compression
  (ADR-0005) run as one bundled background job after the reply returns to
  the client; the *next* turn's generation blocks/joins on that job if
  still in flight, which is what satisfies ticket 05's requirement that
  the compression check run on every incoming message. The avatar's
  `{emotion, avatarBucket}` state pushes over a separate SSE channel (no
  backend typing-indicator needed — the client's own pending request
  covers that). A user message arriving mid-generation cancels and
  restarts the in-flight reply with full updated context, capped to bound
  against livelock. User messages persist on receipt regardless of
  generation outcome; generation failure is an explicit error, no silent
  retry. See [ticket 07](issues/07-response-delivery.md),
  [ADR-0008](../../docs/adr/0008-response-delivery-is-complete-reply-not-token-streaming.md),
  [ADR-0009](../../docs/adr/0009-burst-messages-cancel-and-restart-generation.md).
- Type-sharing architecture design done: tRPC over hand-rolled REST+Zod —
  the project is a single self-hosted deploy with no external/non-TS API
  consumers, so tRPC's usual client/server coupling cost doesn't apply here.
  Normal calls go through tRPC procedures; the avatar-state SSE channel
  (ticket 07) stays outside tRPC entirely, resolving ticket 08's
  streaming-transport question with no dual-path complexity for normal
  calls. Repo is a pnpm workspace with two packages (`server`, `web`, no
  third `packages/shared`) — `web` imports only the inferred `AppRouter`
  type, never server runtime code, which is a structural guarantee rather
  than a discipline. See [ticket 08](issues/08-type-sharing-architecture.md),
  [ADR-0010](../../docs/adr/0010-trpc-in-a-two-package-pnpm-workspace-no-shared-package.md).
- Goals system design done: split "hardcoded goals" into two concepts. A
  single hardwired **Drive** per character (a guiding star, never
  completes, no tracking, lives in character config not the DB) that
  dynamically spawns/retires a small list of completable **Minor Goals**
  in reaction to emotional development — both ends of that lifecycle
  (spawn and retire) and the outcome feedback (completion/retirement
  producing an emotion Stimulus) are judged by the same per-turn LLM call
  that already does ticket 04's appraisal, no separate scoring/planning
  loop. Minor Goals get their own `minor_goals` table (status +
  decaying spawn-intensity as importance, used to enforce a concurrent-
  active cap), not a change to ticket 05's `messages` schema. See
  [ticket 09](issues/09-goals-system.md),
  [ADR-0011](../../docs/adr/0011-goals-are-a-persistent-drive-plus-dynamic-minor-goals.md),
  [ADR-0012](../../docs/adr/0012-goal-lifecycle-piggybacks-on-emotion-appraisal.md).
- Character authoring format design done: a Character exists exactly once,
  ever — no per-user cloning, no template/instance split, which dissolves
  ticket 11's original "multi-user DB provisioning" premise entirely.
  Identity and access are the same mechanism: a CSPRNG-generated Character
  ID doubles as the on-disk key and a `/chat/{id}` bearer-capability URL,
  with no user/account system anywhere. Creation happens via an empty
  `/chat/` form; PAD (the Personality Point) is LLM-inferred from authored
  prose (personality description + a one-shot "emotional tendency" field)
  rather than hand-set, then run through ADR-0002's existing deterministic
  projection table. New characters start with zero Minor Goals. Each
  Character gets its own `data/{id}/` subdirectory holding
  `definition.json` (authored + derived fields), `character.db`, and a
  per-character `character.log`. See
  [ticket 10](issues/10-character-authoring-format.md),
  [ADR-0013](../../docs/adr/0013-character-access-is-a-capability-url-no-accounts.md).
  A re-scope note was left on
  [ticket 11](issues/11-multi-user-auth-db-provisioning.md), whose
  original auth/provisioning questions this now answers.
- Multi-user auth ticket closed; deployment/runtime environment resolved:
  ticket 11 is closed outright — its "one DB per (user, character)"
  premise dissolves entirely into ticket 10/ADR-0013, with nothing left
  to answer. The map's separate deployment/runtime-environment question
  is resolved in its own ticket: runs on a personal machine on the
  operator's own network (Ollama needs local GPU access), started
  manually alongside Ollama with no Docker/supervisor/always-on service.
  Remote access stays in scope independent of the accounts question; TLS
  is mandatory unconditionally (the capability URL is the bearer
  credential), terminated directly by the Node backend, self-signed for
  now via browser TOFU pinning rather than a CA-issued cert (avoids
  Certificate Transparency log exposure; upgrading later is a drop-in
  change). Public reachability is gated by a required bind-address env
  var, crash-on-boot if unset. Capability-URL revocation remains an
  explicitly acknowledged gap, not solved. See
  [ticket 15](issues/15-deployment-runtime-environment.md),
  [ADR-0014](../../docs/adr/0014-home-network-deployment-manual-process-self-signed-tls.md).
- Avatar emotion bucketing design done: reads the Mood layer, dominant
  emotion is whichever component has the highest *raw* value (not a
  baseline-relative deviation, no separate neutral bucket — a cheerful
  character just shows "joy" at rest by design). Ties break via the tied
  components' Baseline Mood values, falling back to a fixed priority order
  only if Baseline Mood also ties. Intensity is 3 tiers (not 5 — matches
  Plutchik's own structure, avoids unanchored extra levels and boundary
  flicker), cutoffs in `tuning.ts`. Produces a fixed, universal 24-slot
  bucket taxonomy (8 emotions × 3 tiers) named with Plutchik's nuance
  vocabulary (e.g. serenity/joy/ecstasy) — this is ticket 13's sourcing
  checklist. See [ticket 12](issues/12-avatar-emotion-bucketing.md),
  [ADR-0015](../../docs/adr/0015-avatar-bucket-is-raw-value-dominant-emotion-x-plutchik-3-tier.md).
- Avatar image sourcing done: a default (non-per-character) 24-image set
  now lives at `assets/avatars/default/`, one PNG per ticket 12 bucket,
  named `{primary}-{tier}-{nuance}.png` (e.g. `joy-low-serenity.png`).
  Each image is a standard Unicode emoji rendered from the system Noto
  Color Emoji font and upscaled to 512×512. Placeholder/default art only —
  bespoke per-character sets can reuse the same naming convention later.
  See [ticket 13](issues/13-source-avatar-images.md).
- LLM model choice decided: `gemma3:12b`, chosen to fit the operator's
  RTX 3060 12GB with headroom for the embedding model and context
  window. See [ADR-0016](../../docs/adr/0016-gemma3-12b-is-the-chat-appraisal-goal-judgment-model.md).

## Not yet specified

- Conversation/session UX shape (multiple simultaneous conversations per
  character? history browsing?) — depends on response-delivery
  ([ticket 07](issues/07-response-delivery.md)) and character-authoring
  ([ticket 10](issues/10-character-authoring-format.md)) landing first.
- Observability/logging strategy.
- Total per-turn prompt token ceiling (Short-term tail + retrieved
  Long-term Memory + system/character prompt + generation headroom) —
  ticket 06 gave retrieval its own flat budget independent of ADR-0005's
  short-term budget, but nothing yet owns the sum across all four.

## Out of scope

- AI-generated/on-the-fly avatar rendering (e.g. local Stable Diffusion or
  an image API) — ruled out in favor of a pre-made image set per emotion
  bucket.
