# Character authoring format

Type: grilling
Status: resolved

## Question

Since the system supports multiple characters from day one, define how a
new character's personality, goals, and configuration get authored and
instantiated:

- What format defines a character (a JSON/YAML file checked into the repo?
  a DB row created via an admin flow? both, with the file as a seed)?
- What fields does a character definition need — name, personality
  description/system-prompt fragment, hardcoded goals (per
  [ticket 09](09-goals-system.md)), initial emotional baseline, avatar
  image set reference (per [ticket 12](12-avatar-emotion-bucketing.md))?
- What happens when a new character is added — does it provision a fresh
  DB automatically, and for whom (interacts directly with
  [ticket 11](11-multi-user-auth-db-provisioning.md))?

## Answer

**A Character exists exactly once, ever** — not a template cloned per user.
There is no user/account system anywhere in this design; "multi-user"
composition (ticket 11's original premise) collapses to nothing, since a
Character *is* already a singular, private thing by construction. See
[ADR-0013](../../../docs/adr/0013-character-access-is-a-capability-url-no-accounts.md).

**Identity and access are the same mechanism**: on creation the server
mints a **Character ID** directly from a CSPRNG (never a hash of a seed or
any other input — nothing here is worth deriving, only generating). This
id is simultaneously the on-disk storage key and the entire access-control
model: `/chat/{id}` is a bearer-capability URL. Whoever holds the link has
full access, including sharing the exact same conversation/emotion/goal
state with anyone else they forward it to — there's no per-sender
distinction anywhere in the Message/Emotion/Goals design, so this is
already exactly what those systems support. `/chat/{id}` for an id that
doesn't exist is a plain 404, nothing more specific.

**Creation flow**: visiting `/chat/` with no id shows a creation form.
Submitting it:
1. If `name` was left blank, one LLM call picks one from the other
   authored fields.
2. One LLM call infers a **Personality Point** (PAD triple) from
   `personalityDescription` + `emotionalTendency` concatenated — the
   existing deterministic Plutchik↔PAD projection table (ADR-0002) then
   derives `baselineMood` and `emotionConstants` from it, unchanged.
3. The character's directory and all three files (below) are written, and
   the browser is redirected to `/chat/{id}`.

Any LLM call failing fails the whole request — no partial/garbage
character is ever created, consistent with this project's existing
"no fallbacks" stance.

**New characters start with zero Minor Goals.** The Drive spawns them
dynamically in reaction to conversation (ticket 09); there's no
"authored starting goals" mechanism, since `spawn_intensity` is emotional
intensity at spawn and nothing has happened yet at creation time to spawn
one from.

**Avatar set**: required explicit pick from a gallery of ticket 13's
sourced packs — unlike name/PAD, this is a purely visual choice an LLM
can't usefully infer, so no auto-fill escape hatch exists for this field.

**On-disk layout**: `data/{id}/`, one subdirectory per Character (chosen
over a flat `data/{id}.json`/`data/{id}.db` layout specifically to leave
room for more per-character files later), containing:

- `definition.json` — the character's complete authored + derived record:
  `id`, `name`, `personalityDescription` (recurring system-prompt
  fragment), `drive`, `avatarSet`, `emotionalTendency` and
  `personalityPoint` (both one-shot creation inputs, kept only for
  reference/copy-paste — never read again at runtime), `baselineMood`,
  `emotionConstants`.
- `character.db` — the Turso/libSQL DB (messages, minor_goals, live
  Mood/Emotion state) — schema owned by tickets 04/05/09, not this one.
- `character.log` — a per-character debug log, kept separate from
  `definition.json` for ongoing debug output (appraisal results, goal
  spawns, etc.) as those systems come online.

**Downstream**: ticket 11 needs to be re-scoped — its "one DB per (user,
character), cloned from a template" framing and its auth-model question
are both answered by the above (no cloning, capability URL instead of
accounts); see the comment left on that ticket. Ticket 12/13 own the
concrete avatar-pack list `avatarSet` references.
