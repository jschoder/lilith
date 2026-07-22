# 24 — Refactor: extract shared Character-or-404 resolution helper

**What to build:** `server/src/router.ts` repeats the same "load a Character's on-disk definition, throw a plain `NOT_FOUND` if it's missing" block verbatim across `character.get`, `conversation.history`, and `conversation.sendMessage` — the latter two introduced by ticket 17. Extract the shared shape into a single helper (e.g. `requireCharacterDefinition(id, dataDir)`) that reads the definition and throws `TRPCError({ code: "NOT_FOUND" })` with no distinguishing detail, and have all three procedures call it instead of inlining the read-and-throw logic.

**Blocked by:** None — the duplication is already present in merged code from tickets 16 and 17

**Status:** ready-for-agent

- [ ] A single helper resolves a Character's definition by id and throws `TRPCError({ code: "NOT_FOUND" })` with no distinguishing detail when it doesn't exist, matching current behavior.
- [ ] `character.get`, `conversation.history`, and `conversation.sendMessage` in `server/src/router.ts` all call the helper instead of each inlining the read-or-throw block.
- [ ] `server/src/router.test.ts` continues to pass with unchanged NOT_FOUND semantics for unknown ids across all three procedures.

## Comments

Flagged by the Standards axis of `/code-review` against `53baa54` (2026-07-22): the
404-resolution block was duplicated three times in `router.ts`, two of which were
new in ticket 17 — Duplicated Code, not a hard standards violation but worth
fixing before a fourth call site copies it again.
