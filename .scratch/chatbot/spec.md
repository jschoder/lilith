# AI Companion Chatbot

Status: ready-for-agent

Synthesized from the fully-resolved wayfinder map at
[map.md](map.md) and its 15 child tickets/ADRs. Every open decision the map
tracked has an answer; the remaining "Not yet specified" items are called
out under Further Notes as non-blocking.

## Problem Statement

A person who wants an AI companion to talk to today gets either a stateless
chatbot that resets its personality and forgets everything between sessions,
or a simple persona-prompted bot whose "emotional reactions" are just
restating the last thing said back with different adjectives. There's no
lightweight, self-hosted companion that carries a persistent, gradually-
shifting emotional state across a conversation, actually remembers past
exchanges (recent ones in full, older ones by relevance), pursues its own
small goals in the background, and shows a visual read of its current mood
— all without standing up user accounts, a hosted backend, or a team to run
it.

## Solution

A self-hosted, single-operator AI companion chatbot. Each companion is a
**Character** — created once via a short authoring form, never cloned or
templated — reachable at a `/chat/{id}` capability URL that doubles as its
entire access-control mechanism. A Character carries:

- A layered **Emotion**/**Mood** state (fast/slow two-speed dynamics over
  Plutchik's 8 primary emotions) that builds and decays in response to
  LLM-judged **Appraisal** of each conversational turn, seeded once at
  creation from an authored personality.
- Persistent memory: a **Short-term Memory** window of recent, uncompressed
  messages, and a **Long-term Memory** of older messages made searchable via
  embeddings, ranked by a blend of similarity, recency, and emotional
  salience.
- A hardwired **Drive** plus dynamically spawned/retired **Minor Goals**,
  judged by the same per-turn LLM call that produces the Emotion Stimulus —
  no separate planning loop.
- A visual **Avatar** whose image is picked from a fixed 24-slot bucket
  taxonomy (dominant Mood emotion × intensity tier), pushed to the client
  over a lightweight background channel.

Replies are delivered as a single complete Message (not token-streamed),
matching real texting cadence rather than a "watch it think" feel. The
system runs on the operator's own machine (for local Ollama/GPU access),
started manually, with TLS mandatory even on LAN since the capability URL is
the only credential in play.

## User Stories

### Character creation & access

1. As an operator, I want to create a new Character via an empty form, so
   that I can bring a new companion online without editing code.
2. As an operator, I want to leave the Character's name blank and have it
   inferred from the rest of what I authored, so that I don't have to
   invent a name myself.
3. As an operator, I want to author a personality description and an
   emotional tendency in free text, so that the Character's temperament is
   derived automatically rather than hand-tuned field by field.
4. As an operator, I want to pick an avatar image set from a gallery during
   creation, so that the Character has a visual identity from its first
   message.
5. As an operator, I want the whole creation flow to fail outright (no
   partial Character left behind) if any part of it fails, so that I never
   end up with a broken, half-created Character.
6. As anyone holding a Character's `/chat/{id}` link, I want full access to
   chat with it, so that sharing the link is the entire invitation
   mechanism.
7. As anyone holding a Character's link, I want to see the exact same
   conversation, emotional state, and goals as anyone else with the link,
   so that the Character is understood as one shared instance, not a
   private per-visitor copy.
8. As a visitor to a `/chat/{id}` for an id that doesn't exist, I want a
   plain 404, so that I get no hint distinguishing "wrong id" from any other
   failure.

### Conversation & response delivery

9. As a user, I want to send a message and get back one complete reply once
   the Character finishes composing it, so that the interaction feels like
   texting a person, not watching text stream in live.
10. As a user, I want to send several messages back-to-back before the
    Character replies, so that I can text the way people actually text.
11. As a user, if I send a new message while a reply to my previous one is
    still generating, I want that reply regenerated against my full,
    updated context, so that I never receive a reply that ignores what I
    just said.
12. As a user, I want my sent messages saved immediately regardless of
    whether the Character's reply generation succeeds or fails, so that my
    side of the conversation is never lost to a generation problem.
13. As a user, I want an explicit, visible error if reply generation fails,
    so that I'm never left wondering whether my message actually went
    through.
14. As a user, I want some visible indication that the Character is
    composing a reply, so that I know it's working rather than stalled.

### Emotion & Mood

15. As a user, I want the Character's emotional reactions to build up
    gradually from repeated related remarks, so that sustained behavior
    (e.g. repeated teasing) compounds instead of resetting every turn.
16. As a user, I want one sufficiently intense remark to spike the
    Character's emotion immediately, so that shocking or extreme statements
    get an immediate, proportionate reaction.
17. As a user, I want the Character's mood swings to fade slower than they
    build, so that a spike of anger doesn't evaporate the instant the topic
    changes.
18. As a user, I want the Character to register more than one emotion at
    once (e.g. nervous excitement), so that its reactions don't collapse
    into a single flat state.
19. As a user, I want the Character's emotional reaction to come from
    genuine understanding of what I said in context, not keyword or
    sentiment matching, so that subtle or sarcastic remarks land correctly.
20. As a user, I want a Character's opposite emotion pairs (e.g. joy and
    sadness) to not both sit at maximum simultaneously, so that its
    emotional state stays psychologically plausible.
21. As an operator, I want each Character's buildup/decay speed per emotion
    to derive from the personality I authored at creation, so that
    different Characters feel emotionally distinct from one another (e.g.
    "quick to anger, slow to calm").
22. As an operator, I want a Character's resting emotional state (Baseline
    Mood) to reflect its authored personality, so that a naturally cheerful
    Character actually reads as cheerful when nothing is happening.

### Memory

23. As a user, I want my recent messages available to the Character in full
    for a while, so that recent context isn't lost or paraphrased away
    immediately.
24. As a user, I want older messages to still be findable by the Character
    much later, so that it doesn't forget things I told it weeks ago.
25. As a user, I want a memory that was highly emotionally charged to be
    able to resurface later even when it's not the most topically relevant
    thing right now, so that emotionally vivid moments can intrude the way
    real memories do.
26. As a user, I want more recent memories favored over older ones of
    similar relevance, so that stale information doesn't dominate what's
    currently going on.
27. As a user, I want a long, continuously active conversation to keep
    folding its trailing edge into long-term memory rather than hitting a
    hard cutoff, so that an extended session doesn't lose context partway
    through.
28. As a user, I want a conversation resumed after a long gap to skip
    replaying a full stale window of old messages, so that picking back up
    doesn't feel like re-reading a wall of old text.
29. As an operator/developer, I want raw message text to never be deleted,
    even after it's been folded into long-term memory, so that I retain a
    full audit trail for debugging.
30. As an operator/developer, I want the Character's memory retrieval,
    compression thresholds, and emotion decay all governed by one
    hand-editable set of tuning constants, so that I can adjust model
    behavior without hunting across modules.

### Goals

31. As a user, I want the Character to have a persistent underlying drive
    that colors its perspective, so that it feels like it wants something
    beyond just replying to me.
32. As a user, I want that underlying drive to stay in the background
    rather than being announced every message, so that it reads as a
    disposition, not a scripted agenda.
33. As a user, I want the Character to spontaneously form small, concrete
    goals in reaction to how the conversation develops emotionally, so that
    it can pursue things like "learn the user's name" organically.
34. As a user, I want a Character's small goal marked completed when it's
    actually achieved in conversation, so that its behavior reflects real
    progress rather than a fixed script.
35. As a user, I want a Character's small goal to fade away (retire) if its
    motivating emotion fades before it's achieved, so that abandoned
    pursuits don't linger forever.
36. As an operator, I want a cap on how many small goals a Character
    pursues at once, so that its behavior doesn't fragment across too many
    competing objectives.
37. As an operator, I want a newly created Character to start with zero
    small goals, so that its goal list only ever reflects things that
    actually happened in conversation.

### Avatar

38. As a user, I want the Character's avatar image to update in response to
    its emotional state, so that I get a visual read on its mood alongside
    the text.
39. As a user, I want the avatar's dominant emotion to reflect the
    Character's personality at rest, so that a naturally anxious Character
    looks anxious even when nothing dramatic is happening.
40. As a user, I want the avatar to show different intensity levels of the
    same emotion (mild vs. intense), so that subtle and extreme reactions
    look visually distinct.
41. As a user, I want the avatar update to arrive shortly after a reply even
    though it's computed in the background, so that the visual mood
    reaction still feels connected to what was just said.
42. As an operator, I want a default avatar image set available out of the
    box, so that a newly created Character has visuals before any bespoke
    art is commissioned.

### Deployment & access

43. As an operator, I want to start the server manually alongside Ollama
    only while I'm actually using it, so that I don't need to run an
    always-on service on my personal machine.
44. As an operator, I want all traffic to the server encrypted with TLS
    unconditionally, including on my own LAN, so that the capability URL —
    my only access control — is never transmitted in the clear.
45. As an operator, I want to explicitly opt in, via a required setting, to
    exposing the server beyond my home network, so that I never accidentally
    expose it by default.
46. As an operator, I want the server to crash on boot if required
    configuration (e.g. bind address) is missing, so that I never
    accidentally run with an unintended default.
47. As an operator, I want it made clear that a leaked capability URL can't
    currently be revoked short of deleting the Character outright, so that
    I know to treat the link itself as a durable secret.

### Architecture (developer-facing, still shapes acceptance criteria)

48. As a developer, I want frontend and backend to share types end-to-end
    without hand-written REST glue, so that a server-side schema change
    surfaces as a frontend compile error rather than a silent runtime
    mismatch.
49. As a developer, I want the frontend package structurally prevented from
    importing server-only runtime code (DB driver, LLM client), so that an
    accidental server dependency reaching the browser bundle is a build
    error, not a discipline to maintain by hand.

## Implementation Decisions

### Repository & type-sharing

- pnpm workspace, two packages: `server` and `web` — no third
  `packages/shared`. `web` consumes only the inferred tRPC `AppRouter`
  *type* from `server`, never its runtime code.
- Normal request/response calls (send message, fetch history, create
  Character, list Characters, etc.) are tRPC procedures. The avatar-state
  push is a separate plain SSE (`EventSource`) endpoint outside tRPC
  entirely — it's a one-way server→client broadcast, not an RPC, and tRPC
  subscriptions would require WebSockets for no benefit here.
- No client-side reuse of server Zod validators; server-side validation is
  authoritative and this project doesn't prioritize fail-fast client form
  validation at its scale.

### Character identity, storage & creation

- A Character exists exactly once, ever — never cloned or templated per
  visitor. There is no user/account system anywhere in the product.
- **Character ID**: minted directly from a CSPRNG at creation (never derived
  or hashed from any other input). Doubles as the on-disk storage key and
  the entire access-control mechanism: `/chat/{id}` is a bearer-capability
  URL. A nonexistent id is a plain 404.
- **Creation flow** (`/chat/` with no id shows the form): on submit —
  1. If `name` is blank, one LLM call picks one from the other authored
     fields.
  2. One LLM call infers a Personality Point (PAD triple) from
     `personalityDescription` + `emotionalTendency`; the deterministic
     Plutchik↔PAD projection table then derives `baselineMood` and
     `emotionConstants` from it.
  3. The Character's directory and files are written, and the client is
     redirected to `/chat/{id}`.
  - Any LLM call failing fails the whole request — no partial Character is
    ever persisted.
  - Avatar set is a required explicit gallery pick (not LLM-inferred) —
    it's a purely visual choice.
  - A new Character starts with zero Minor Goals.
- **On-disk layout**: `data/{id}/` per Character, containing:
  - `definition.json` — `id`, `name`, `personalityDescription`, `drive`,
    `avatarSet`, `emotionalTendency` and `personalityPoint` (one-shot
    creation inputs kept for reference only, never read again at runtime),
    `baselineMood`, `emotionConstants`.
  - `character.db` — the libSQL database (messages, minor_goals, live
    Emotion/Mood state).
  - `character.log` — a per-character debug log (appraisal results, goal
    spawns, etc.), kept separate from `definition.json`.

### Emotion & Mood engine

- Runtime state: one scalar in `[0,1]` per Plutchik primary (joy, trust,
  fear, surprise, sadness, disgust, anger, anticipation), stored twice — a
  fast **Emotion** layer and a slow **Mood** layer (ALMA's two-speed
  dynamics, applied per-dimension rather than to a single PAD point).
- **Buildup**: a Stimulus sets/raises the Emotion-layer value for its
  dimension(s); the Mood-layer value is pulled toward it (if approaching)
  or pushed further past it (if already reached), saturating at 1.0.
- **Decay**: exponential, computed lazily from elapsed real time since last
  update (`value *= 0.5^(elapsed/half_life)`), independent half-life per
  emotion per layer per Character. Starting defaults: ~5min (Emotion
  layer), ~6hr (Mood layer).
- **Cross-emotion interaction**: opposite-pair suppression only (joy↔sadness,
  trust↔disgust, fear↔anger, surprise↔anticipation), applied at appraisal
  time — a Stimulus to one member dampens the other by
  `suppression_fraction × stimulus_intensity` (constant TBD, see Further
  Notes).
- **Stimulus trigger**: LLM-judged Appraisal of each conversational turn,
  piggybacked on the reply-generation call, sparse output (only the 1-3
  emotions actually evoked).
- **Character creation seeding**: personality authored once as a PAD point,
  projected through a canonical Plutchik↔PAD coordinate table into
  `baselineMood` and default per-emotion buildup-gain/decay-half-life
  constants. PAD is discarded after creation — never read again at runtime.

### Memory

- Single permanent `messages` table serves as audit log, Short-term Memory
  (live query over its uncompressed tail), and Long-term Memory (same rows
  once Compressed) — no separate tables, no deletion step, no
  `character_id` column (the per-character DB file is the scope boundary):

  ```sql
  CREATE TABLE messages (
    id                     INTEGER PRIMARY KEY,
    sender                 TEXT NOT NULL,        -- 'user' | 'character'
    text                   TEXT NOT NULL,        -- kept forever
    created_at             TIMESTAMP NOT NULL,
    emotion_vector         TEXT NOT NULL,        -- full 8-dim Emotion snapshot (JSON)
    peak_emotion_intensity REAL NOT NULL,        -- max() of the vector above
    embedding              F32_BLOB(768),        -- NULL until Compressed
    compressed_at          TIMESTAMP,            -- NULL = still in the live short-term tail
    summary_id             INTEGER REFERENCES memory_summaries(id)
  );

  CREATE TABLE memory_summaries (
    id         INTEGER PRIMARY KEY,
    gist_text  TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL
  );
  ```

- **Compression** = computing and attaching `embedding`
  (`nomic-embed-text`, 768-dim) and `peak_emotion_intensity` to a Message —
  it never touches `text`. Long-term Memory is per-message (its own
  embedding per row), not per-batch; a Memory Summary is an additive,
  citation-only layer (`summary_id`) generated per compression batch, never
  a replacement for the source Messages.
- **Compression trigger**: a single decaying effective token budget —
  `effective_budget = max(floor, base_budget × decay(idle_time))`, same
  exponential shape as the Mood decay above. Whatever exceeds the current
  effective budget Compresses, oldest first. Cumulative/peak
  `peak_emotion_intensity` in the current short-term window is a secondary
  trigger that can force early Compression under budget.
- **Retrieval** (Long-term Memory only — Short-term stays unconditional): a
  single-stage weighted sum, one SQL `ORDER BY`, no pre-filter floor:

  ```sql
  SELECT *,
         (1 - vector_distance_cos(embedding, :query_embedding) / 2) AS similarity,
         POWER(0.5, (julianday('now') - julianday(created_at)) * 24 / :recency_half_life_hours) AS recency_factor
  FROM messages
  WHERE embedding IS NOT NULL
  ORDER BY (:w_sim * similarity + :w_rec * recency_factor + :w_sal * peak_emotion_intensity) DESC
  LIMIT :max_candidates
  ```

  Candidates are walked in descending blended-score order and greedily
  added to the prompt until a flat `retrieval_token_budget` is exhausted or
  a candidate's score falls below `min_retrieval_score`. `messages` is
  queried with an unindexed full scan (`vector_distance_cos`, no
  `libsql_vector_idx`) — correct at this project's per-character-file scale
  per the vector-search research. `memory_summaries` is never part of
  retrieval (no embedding column).
- Embeddings via Ollama's `nomic-embed-text` (768-dim), fitting comfortably
  within libSQL's `F32_BLOB` ceiling.
- All constants above (weights, half-lives, budgets, floors, thresholds)
  are global, not per-character — they don't trace through the Personality
  Point projection, so they live in one hardcoded `tuning.ts`, not env vars
  (the "every env var required" rule targets deployment config, not
  model-behavior tuning).

### Goals

- **Drive**: exactly one per Character, hardwired at creation (e.g. "world
  domination") — never completes, no progress tracking, never mutated at
  runtime, lives in `definition.json`. Injected into the prompt every turn,
  framed as a background disposition via prompt phrasing alone (no
  suppression/relevance-gating mechanism).
- **Minor Goal**: a small, possibly-empty list of concrete, completable
  objectives the Drive dynamically spawns/retires in reaction to the
  Character's emotional development. Own table, rows never deleted:

  ```sql
  CREATE TABLE minor_goals (
    id              INTEGER PRIMARY KEY,
    text            TEXT NOT NULL,
    status          TEXT NOT NULL,   -- 'active' | 'completed' | 'retired'
    spawn_intensity REAL NOT NULL,   -- emotional intensity at spawn; decays like Mood
    spawned_at      TIMESTAMP NOT NULL,
    ended_at        TIMESTAMP        -- NULL while active
  );
  ```

  Importance is `spawn_intensity` decaying exponentially from `spawned_at`
  (same shape as Mood decay), computed on the fly — never re-boosted after
  spawn. A concurrent-active-goal cap (constant TBD) is enforced by
  auto-retiring whichever active Minor Goal has decayed to the lowest
  importance.
- **Mechanism**: no separate planning/scoring loop. The same per-turn
  LLM-judged, sparse, structured-output call that produces the Emotion
  Stimulus is extended to also judge Minor Goal completion/retirement and
  possible new-goal spawning, and to react to a completion/retirement with
  its own Emotion Stimulus in the same call. No hardcoded mapping from goal
  outcome to emotional reaction — only contextual LLM judgment.

### Avatar

- Reads the **Mood** layer, not Emotion. **Dominant emotion**: whichever of
  the 8 Mood components has the highest *raw* value — not baseline-relative
  deviation, no separate neutral bucket (a naturally cheerful Character
  shows "joy" at rest by design).
- **Tiebreak** (components within an epsilon, e.g. 0.02): compare Baseline
  Mood for just the tied components, higher wins; if Baseline Mood also
  ties, fixed fallback order `fear > anger > disgust > sadness > surprise >
  anticipation > trust > joy`.
- **Intensity tier**: dominant component's raw value binned into 3 even
  tiers — low `[0, 0.33)`, mid `[0.33, 0.66)`, high `[0.66, 1.0]` (global
  constants in `tuning.ts`).
- **Bucket** = (dominant emotion, tier), a fixed universal 24-slot taxonomy,
  named with Plutchik's nuance vocabulary (e.g. `joy-low-serenity`).
  Filename convention: `{primary}-{tier}-{nuance}.png`. A default 24-image
  set already exists at `assets/avatars/default/` (upscaled Noto Color Emoji
  renders) — bespoke per-character sets can follow the same convention
  later.
- **Delivery**: computed as part of the same bundled background job as
  Appraisal/Compression (see Response delivery below), pushed to the client
  over a dedicated SSE channel as `{emotion, avatarBucket}`, separate from
  the tRPC request/response cycle.

### Response delivery

- Replies are delivered as a single complete Message, not token-streamed.
- Appraisal and the compression-trigger-check/Compression run as one
  bundled background job *after* the reply is returned to the client — the
  *next* turn's generation blocks/joins on that job if still in flight, so
  its prompt always sees up-to-date Emotion/Mood and a correctly-Compressed
  short-term tail.
- No backend-driven typing indicator: under complete-reply, the client's
  own request stays pending for the whole generation window, so "typing…"
  is rendered purely from local request-pending state.
- **Burst handling**: a new user message arriving mid-generation cancels the
  in-flight generation and restarts it with the full updated context,
  capped to a bounded number of restarts (constant TBD) to prevent
  livelock.
- User messages persist on receipt regardless of generation outcome.
  Generation failure is an explicit client-visible error, no automatic
  retry/fallback.

### Deployment & security

- Runs on the operator's own machine (Ollama needs local GPU access),
  started manually alongside Ollama — no Docker, no process supervisor, no
  always-on service.
- TLS is mandatory unconditionally, including on LAN — no plaintext-HTTP
  mode exists anywhere, since the capability URL is the entire bearer
  credential. The Node backend terminates TLS directly (no reverse proxy).
- Public reachability is gated by a required bind-address env var (public
  vs. loopback/LAN-only); missing env var crashes on boot.
- Certificate is self-signed for now, accepted via browser
  Trust-On-First-Use pinning — avoids publishing the deployment's hostname
  to public Certificate Transparency logs. Upgrading to a CA-issued cert
  later is a documented, drop-in path.
- No capability-URL revocation mechanism exists — an accepted, explicit gap.

## Testing Decisions

A good test here asserts on externally observable behavior — stored rows,
RPC return values, SSE payloads, computed labels/buckets — never on
internal call counts or implementation-detail mocks. The only fake
anywhere in the system is a single LLM/embedding adapter port (chat +
structured-output appraisal/goal-judgment, and embedding generation); the
real libSQL file-backed database is used at every seam, including the
lower-level ones — nothing mocks the DB.

Two layers of seams, in this order:

1. **Lower-level seams per subsystem**, each a pure function or a thin
   module operating on real (non-mocked) inputs, with no server/tRPC/LLM
   involved:
   - Emotion/Mood engine: `(state, elapsedTime, stimulus) → nextState` —
     covers buildup, decay, saturation, and opposite-pair suppression
     directly.
   - Compression trigger: `(idleTime, cumulativePeakIntensity) →
     effectiveBudget/triggerDecision` — covers the decaying-budget formula
     and the emotional-promotion override independently of any DB write.
   - Retrieval scoring: the weighted-sum query run directly against a real
     libSQL file seeded with known rows/embeddings — covers ranking,
     normalization, and the token-budget/`min_retrieval_score` cutoff
     without going through tRPC.
   - Goal lifecycle: `(currentGoals, llmJudgment) → nextGoals` — covers
     completion/retirement/spawn transitions and the concurrent-active-cap
     eviction independent of the LLM call that produces the judgment.
   - Avatar bucket selection: `(moodVector, baselineMood) → bucket` —
     covers dominant-emotion selection, tiebreaking, and tier binning as a
     pure function.
2. **One integration seam**, the real Node HTTP server (tRPC procedures +
   the SSE avatar-state endpoint) started against a real ephemeral libSQL
   character-DB file in a temp directory, with the LLM/embedding adapter
   swapped for the deterministic fake. Tests drive it as a real client
   (tRPC caller + `EventSource` consumer) and assert end-to-end outcomes —
   a sent message is persisted, Emotion/Mood/Minor Goals change as
   expected, the avatar-bucket SSE payload matches — confirming the
   subsystems above are wired together correctly. This layer isn't where
   the internal math of any one subsystem gets re-verified; that's what
   layer 1 is for.

No prior art exists in this repo yet — it's greenfield, no code committed
as of this spec. Deployment/TLS (bind-address gating, self-signed cert
behavior) is explicitly not covered by either seam; it's an operational
concern verified manually against a running deployment, not exercised by
automated tests.

## Out of Scope

- AI-generated/on-the-fly avatar rendering (e.g. local Stable Diffusion or
  an image API) — the avatar is always a pre-made image picked from a
  fixed set.
- User accounts, login, sessions, or per-(user, character) cloning — a
  Character exists exactly once, ever; access is the capability URL alone.
- Capability-URL revocation or rotation.
- Token-by-token streaming of replies.
- An explicit planning/scoring loop for goal-directed response generation
  (candidate generation + scoring).
- Docker, a process supervisor, or any always-on service model.
- CA-issued TLS certificates, Let's Encrypt, or Dynamic DNS (documented
  future upgrade path, not part of this build).
- Bespoke per-character avatar art — only the default 24-image set ships
  now; per-character art reuses the same naming convention later.
- A public or non-TypeScript API consumer (would require revisiting the
  tRPC-only architecture decision).
- The libSQL ANN vector index (`libsql_vector_idx`) — an unindexed scan is
  used at this project's per-character-file scale.

## Further Notes

The wayfinder map left four items explicitly unresolved; one is now
decided. None of the remainder block starting implementation, but an
implementing agent should either make a documented default choice or flag
them for a follow-up decision rather than silently guessing:

- ~~**LLM model choice.**~~ Decided: `gemma3:12b`, sized to fit the
  operator's RTX 3060 12GB with headroom for the embedding model and
  context window. Ollama's `format` JSON-schema parameter (constrained
  decoding, not prompt-only) resolves the structured-output reliability
  concern at the tooling layer rather than needing a model picked for
  that reason specifically. See [ADR-0016](../../docs/adr/0016-gemma3-12b-is-the-chat-appraisal-goal-judgment-model.md).
- **Conversation/session UX shape.** Whether a Character supports multiple
  simultaneous conversations, and whether any history-browsing UI beyond
  the live chat view is needed.
- **Observability/logging strategy** beyond the per-character
  `character.log` file already decided for debug output (appraisal
  results, goal spawns).
- **Total per-turn prompt token ceiling.** Short-term tail + retrieved
  Long-term Memory + system/character prompt + generation headroom each
  have their own budget; nothing yet owns the sum across all four to
  guarantee the assembled prompt fits the model's context window.

A number of tuning constants are deliberately left unpinned pending
implementation-time calibration (all destined for the single `tuning.ts`):
the opposite-pair `suppression_fraction`; the compression budget's
`floor`/`half_life`/`emotional_threshold`; retrieval's
`w_sim`/`w_rec`/`w_sal`/`recency_half_life`/`retrieval_token_budget`/
`min_retrieval_score`; the concurrent-active-Minor-Goal cap; and the
burst-message restart cap. None of these need a fixed value to start
building — they're hand-editable constants, not architectural decisions —
but a calibration pass (the map suggested a large-scale scenario sweep for
`suppression_fraction` specifically) should happen before relying on the
system's emotional behavior feeling well-tuned.
