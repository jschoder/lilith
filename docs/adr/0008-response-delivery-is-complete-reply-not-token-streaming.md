# Response delivery is complete-reply, not token-streaming

Candidates were token-by-token streaming (SSE/WebSocket from Ollama through
the Node backend to React, ChatGPT-style) or delivering each character
reply as a single complete Message once generation finishes. We chose
complete-reply. The Message glossary term already frames this product as
matching "real-person texting cadence," not a live-transcription feel —
and real IM apps (iMessage, WhatsApp) don't stream text token-by-token
either; they show a message as a discrete arrived unit, optionally with a
typing indicator beforehand. Token-streaming is a pattern borrowed from
tools built around "watch the AI think," which isn't the mental model
here. Local Ollama generation is also fast enough that streaming's main
benefit — perceived responsiveness — is marginal (on the order of a
second saved at best).

Complete-reply also sidesteps the side-effect-timing problem
[ticket 07](../../.scratch/chatbot/issues/07-response-delivery.md) was
opened to resolve: Appraisal and the compression-trigger check (both from
[ADR-0005](0005-compression-trigger-is-decaying-budget-plus-emotional-promotion.md))
run as one bundled background job after the reply is returned to the
client, rather than needing to interleave with an in-progress token
stream. The next turn's generation blocks/joins on that job if still in
flight, guaranteeing its prompt sees up-to-date Emotion/Mood and a
correctly-Compressed short-term tail.

One consequence: the avatar's emotion-driven expression can't ride the
same request/response cycle as the message (there's no request left
in-flight during the backgrounded appraisal window to attach it to). A
separate, lightweight SSE channel pushes `{emotion, avatarBucket}` updates
to the client once appraisal completes — SSE rather than WebSocket, since
this channel is server→client only. No backend-driven typing indicator is
needed either: under complete-reply, the client's own request is pending
for the entire generation window, so "typing…" is rendered purely from
local request-pending state.

This also answers a question [ticket 08](../../.scratch/chatbot/issues/08-type-sharing-architecture.md)
raised: streaming (of avatar state) needs a transport path separate from
the main RPC/REST call regardless of whether ticket 08 picks tRPC or
hand-written REST for normal calls.
