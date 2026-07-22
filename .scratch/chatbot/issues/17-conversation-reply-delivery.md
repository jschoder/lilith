# 17 — Conversation: complete reply delivery with burst handling

**What to build:** End-to-end texting — send a message at `/chat/{id}`, always have it land in the `messages` table immediately, then get back one complete reply (never token-streamed) once generation finishes. Covers burst handling (a new message mid-generation cancels and restarts, capped) and explicit failure surfacing, with a client-only typing indicator driven by request-pending state.

**Blocked by:** 16

**Status:** ready-for-agent

- [x] Sending a message via the chat UI immediately persists it to `messages` regardless of what happens next.
- [x] A successful generation returns and persists exactly one complete reply Message — no partial/token-streamed output at any point.
- [x] While a reply is generating, the client shows a "composing" indicator driven purely from its own request-pending state (no backend push required).
- [x] Sending a second user message while a reply to the first is still generating cancels the in-flight generation and restarts it against the full updated context (both messages).
- [x] Repeated rapid messages stop restarting generation after a fixed cap, guaranteeing eventual reply delivery instead of livelock.
- [x] A generation failure surfaces as an explicit, visible error to the user; the previously-sent user message remains persisted and there is no silent retry.

## Comments

Implemented. A single permanent `messages` table (ADR-0003) is created
alongside `minor_goals` in `writeCharacterDirectory`, with placeholder
zero `emotion_vector`/`peak_emotion_intensity` columns that ticket 18's
Appraisal will fill in.

`conversation.sendMessage` persists the user message immediately, then
generates one complete (non-streamed) reply via `generateStructured`
against a `{ reply: string }` schema — the transcript is the full raw
message history, no token-budget windowing yet (that's ticket 20/21).
`LlmPort.generateStructured` grew an optional `signal?: AbortSignal`,
threaded through to `fetch` in `OllamaLlmPort`, so cancellation actually
stops the in-flight network call rather than just being ignored.

Cancel-and-restart burst handling (ADR-0009) lives in a new
`ConversationManager`/`GenerationSession` (`conversation/session.ts`),
keyed per-Character: a new message before the current attempt settles
aborts it and restarts with fresh context, up to `GENERATION_RESTART_CAP`
(`tuning.ts`, per ADR-0007) restarts; every caller across the burst —
including ones already awaiting a since-superseded attempt — resolves to
the same final reply via a version-check/redirect chain. Past the cap,
new messages persist but do not restart the in-flight generation, so a
reply is always eventually delivered.

The client (`ChatPage.tsx`) shows the user's own message optimistically
on submit, tracks a local pending-messages array (not the mutation's own
`isPending`, since a burst can have several `sendMessage` calls in
flight at once) to drive the "composing…" indicator, and surfaces
generation failure as a visible error without retrying — the persisted
user message stays either way.

Verified end-to-end against a live Ollama backend (both via `curl` and a
headless-browser smoke test): a burst of two rapid messages correctly
produced exactly one character reply addressing only the latest message,
with both prior/duplicate requests resolving to it.
