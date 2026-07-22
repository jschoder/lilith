# Type-sharing architecture

Type: grilling
Status: resolved

## Question

For connecting frontend/backend types: plain Zod schemas (hand-written REST
endpoints validated with Zod on both ends) vs. tRPC (Zod-based, but also
generates the RPC layer itself — no manual fetch/route wiring)?

Considerations to weigh explicitly: end-to-end type safety in both cases;
tRPC's reduction of REST boilerplate vs. its coupling of client and server
to the same TS monorepo; whether streaming responses (pending
[ticket 07](07-response-delivery.md)) work cleanly through tRPC or need a
separate SSE/WebSocket path regardless of the RPC choice for normal calls.

## Answer

**tRPC**, not hand-rolled REST+Zod. The project is a single self-hosted
deploy with no external/non-TS API consumers on the roadmap, so tRPC's
usual downside — coupling client and server to one TypeScript build — costs
nothing here, while it removes hand-written route wiring and the need to
keep duplicate request/response Zod schemas in sync by hand on both ends.
See [ADR-0010](../../../docs/adr/0010-trpc-in-a-two-package-pnpm-workspace-no-shared-package.md).

**Streaming**: resolved by [ticket 07](07-response-delivery.md) — normal
calls are complete-reply (non-streaming) and go through tRPC procedures;
the avatar-state push is a separate plain SSE `EventSource` endpoint
outside tRPC entirely (tRPC subscriptions want WebSockets; this is a
one-way server→client broadcast, not an RPC), so no dual-transport question
for *normal* calls.

**Repo structure**: a pnpm workspace with two packages, `server` and `web`
— not a flat single package, and no third `packages/shared`. `web` imports
only the inferred `AppRouter` *type* from `server`, so an accidental
runtime import of a server-only dependency (DB driver, Ollama client) into
the browser bundle is a hard dependency-resolution error rather than a
discipline to maintain by hand. No shared schemas package: tRPC's type
inference already surfaces server-schema changes as `web` compile errors,
and the only additional thing a shared package buys — reusing the literal
Zod validator for client-side pre-submit form validation — isn't needed,
since server-side validation is authoritative at this project's scale.
