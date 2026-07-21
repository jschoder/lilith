# 16 — Foundation: workspace scaffold, LLM adapter port, Character creation & capability-URL access

**What to build:** An operator can create a new Character through an empty authoring form and reach it going forward at a permanent, unguessable `/chat/{id}` URL — with no user accounts anywhere. Submitting the form runs LLM-backed inference (name if left blank, a PAD personality point from authored text) through a single swappable LLM/embedding adapter port, deterministically projects a Baseline Mood and emotion constants from that point, and writes the Character's on-disk directory. Any failure in the flow leaves no partial Character behind. Visiting an unknown id gives a plain 404. This ticket also stands up the pnpm workspace (server + web, wired through tRPC) that every later ticket builds on.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [x] pnpm workspace with `server` and `web` packages; `web` only imports the inferred tRPC `AppRouter` type, never server runtime code.
- [x] A single LLM/embedding adapter port exists with a real Ollama-backed implementation and a deterministic fake usable by tests — no other component talks to Ollama directly.
- [x] Submitting the creation form with only `personalityDescription` + `emotionalTendency` (name left blank) produces a Character with an LLM-inferred name, a PAD-derived `baselineMood` and `emotionConstants`, and a required avatar-set gallery pick.
- [x] The Character ID is minted from a CSPRNG at creation and used as both the on-disk key and the `/chat/{id}` capability URL — never derived from any other input.
- [x] `data/{id}/definition.json`, `character.db`, and `character.log` are created together; if any step in creation fails (including an LLM call), no Character directory is left on disk.
- [x] Visiting `/chat/{id}` for a nonexistent id returns a plain 404 with no distinguishing detail.
- [x] A new Character starts with zero Minor Goals (empty `minor_goals` table).

## Comments

Implemented. `server` (Express + tRPC + libSQL) and `web` (React + Vite) packages
stood up as a pnpm workspace; `web` depends on `@lilith/server` only for the
type-only `AppRouter` export (`server/src/index.ts`), enforced structurally by
`server/package.json`'s `exports` map having no runtime condition. `LlmPort`
(`server/src/llm/port.ts`) is the single seam to Ollama, with `OllamaLlmPort`
(real) and `FakeLlmPort` (deterministic, hash-seeded, used across the test
suite) implementations. PAD→baselineMood/emotionConstants projection
(`server/src/character/pad.ts`) uses a cosine-alignment formula against a
hand-assembled Plutchik↔PAD table, documented as invented per ADR-0002.
Character creation (`server/src/character/create.ts` +
`server/src/character/store.ts`) mints a CSPRNG id, runs both LLM calls before
any disk write, and rolls back the whole `data/{id}/` directory if any step
fails, verified by tests. `/chat/{id}` 404 handling is client-rendered (SPA,
no SSR — consistent with the tRPC/no-shared-package architecture ADR-0010
sets up); the tRPC `character.get` procedure itself throws a plain
`NOT_FOUND` with no distinguishing detail.

Verified via automated tests (29 passing, `pnpm -r test`), `tsc --noEmit` on
both packages, and a manual end-to-end pass against a live Ollama instance
(model `mannix/llama3.1-8b-abliterated:tools-q5_k_m` — noted in
`server/.env.example`; `gemma4:e4b` was tried first but proved unreliable at
honoring Ollama's structured-output `format` constraint, occasionally
returning raw text instead of JSON) and a headless-browser run of the
creation form through to the redirected `/chat/{id}` page and the 404 page
for an unknown id.

Reviewed via `/code-review` against 53baa54: Standards axis found no
documented-standard violations and three minor judgement-call smells (all
addressed — a duplicated prompt-template string was extracted, and a
speculative avatar-preview image that hardcoded a ticket-12/13 filename
convention was removed from the creation form). Spec axis confirmed all 7
checklist items met.
