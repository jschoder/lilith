# tRPC in a two-package pnpm workspace, no shared package

Frontend and backend are a single self-hosted deploy with no external API
consumers, so tRPC's requirement that both sides build from one TypeScript
project carries no real cost here — while it removes the hand-written route
wiring and duplicated request/response Zod schemas that plain REST+Zod would
otherwise require keeping in sync by hand. Normal request/response calls
(send message, fetch history, list characters, etc.) go through tRPC
procedures; the avatar-state push (ADR-0008/ADR-0009) stays a separate plain
SSE `EventSource` endpoint outside tRPC, since tRPC subscriptions require
WebSockets and this is a one-way server→client broadcast, not an RPC.

The repo is a pnpm workspace with two packages, `server` and `web`, rather
than one flat package — `web` imports only the inferred `AppRouter` *type*
from `server`, never runtime code, so a server-only dependency (DB driver,
Ollama client) accidentally reaching the browser bundle is a hard
dependency-resolution error rather than a discipline to maintain by hand.

## Considered options

- **Flat single package.** Rejected: nothing structurally stops `web` from
  importing real server runtime code alongside types.
- **Third `packages/shared` for Zod schemas.** Rejected: tRPC's type
  inference already surfaces server-schema changes as `web` compile errors
  without one; the only thing a shared package would additionally buy —
  reusing the literal Zod validator for client-side pre-submit form
  validation — isn't needed, since server-side validation is authoritative
  and this project doesn't prioritize fail-fast form UX at its scale.

## Consequences

If a public or non-TS API consumer is ever needed, this decision needs
revisiting — tRPC serves TypeScript clients directly and would need an
OpenAPI/REST adapter layered on top (e.g. `trpc-openapi`) rather than being
consumed raw.
