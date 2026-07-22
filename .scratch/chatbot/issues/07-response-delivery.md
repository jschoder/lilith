# Response delivery: streaming vs. complete reply

Type: grilling
Status: resolved

Blocked by: 05

## Question

Should chat responses stream token-by-token to the frontend (SSE or
WebSocket from Ollama through the Node backend to React), or arrive as a
single complete reply?

This was left open deliberately because the answer depends on
[ticket 05](05-memory-compression-pipeline.md)'s pipeline shape: emotion
updates and memory writes need the full reply text to run their appraisal
step. If streaming is chosen, define when/how those side effects run
relative to the stream (after stream completion? do they block the *next*
turn but not the current one?). If complete-reply is chosen, confirm the
UX tradeoff is acceptable.

## Answer

**Complete reply, not token-streaming.** The Message glossary term already
frames this as matching real-person texting cadence, not a
live-transcription feel; real IM apps don't stream text token-by-token
either. Local Ollama generation is fast enough that streaming's main
benefit (perceived responsiveness) is marginal. See
[ADR-0008](../../../docs/adr/0008-response-delivery-is-complete-reply-not-token-streaming.md).

**Side-effect timing (resolves ticket 05's open dependency)**: Appraisal
and the compression-trigger-check/Compression (ADR-0005) run as one
bundled background job *after* the reply is returned to the client — never
blocking the current turn. The *next* turn's generation blocks/joins on
that job if it's still in flight, guaranteeing the next prompt sees
up-to-date Emotion/Mood and a correctly-Compressed short-term tail. This
is what satisfies ticket 05's requirement that the compression-trigger
check run on every incoming message, not just periodically.

**Avatar-state delivery**: since there's no client request in-flight
during that backgrounded window, the avatar's `{emotion, avatarBucket}`
update pushes to the client over a dedicated SSE channel (server→client
only, so SSE over WebSocket), separate from the message request/response.
No backend-driven typing indicator is needed alongside it — under
complete-reply the client's own request stays pending for the whole
generation window, so "typing…" is rendered purely from local
request-pending state.

**Burst handling**: a new user message arriving while a reply is still
generating cancels the in-flight generation and restarts it with the full
updated context (cancel-and-restart), rather than queueing a second reply
or debouncing every message with a collection window. Capped to a bounded
number of restarts (a `tuning.ts` constant, per ADR-0007) to prevent
livelock. See [ADR-0009](../../../docs/adr/0009-burst-messages-cancel-and-restart-generation.md).

**Persistence & failure**: user messages persist to `messages` immediately
on receipt, independent of generation outcome. Generation failure surfaces
as an explicit client-visible error with no automatic retry/fallback,
consistent with the project's "no fallbacks, anywhere, ever" stance.

**Downstream**: answers [ticket 08](08-type-sharing-architecture.md)'s open
question of whether streaming needs a transport path separate from the
main RPC/REST call regardless of RPC choice — yes, the SSE avatar-state
channel is separate infrastructure either way.
