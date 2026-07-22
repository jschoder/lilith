# Multi-user auth & per-(user, character) DB provisioning

Type: grilling
Status: resolved

Blocked by: 10

## Question

Multi-user/remote access is in scope now, not deferred. The per-character
DB-file design is locked in, but composing it with multi-user needs a
concrete answer:

- Is it literally one DB file per (user, character) pair — i.e. every user
  gets their own independent copy of a character, with independent
  memory/emotion state? Or do users share a character's DB (raising
  concurrent-access and privacy questions)?
- If per-(user, character): how does provisioning work when a user first
  starts talking to a character defined per
  [ticket 10](10-character-authoring-format.md) — cloned from a template
  DB? created fresh with seed data?
- What's the auth model (username/password with sessions? something
  simpler given this is likely a small/self-hosted user base)?
- Where does user identity get checked — every request, or session-based?

## Comments

Ticket 10's resolution changes this ticket's premise substantially — worth
re-scoping (or closing) rather than answering the questions above as
written. Per [ticket 10](10-character-authoring-format.md) and
[ADR-0013](../../../docs/adr/0013-character-access-is-a-capability-url-no-accounts.md):
a Character exists exactly once, ever, with no per-(user, character)
cloning, and access is a bearer-capability URL (`/chat/{id}`, id generated
from a CSPRNG at creation) rather than any user/account system. There is
no "provisioning for whom" question — provisioning happens exactly once,
at creation, full stop — and no auth model beyond "possession of the URL
is access." Whatever remains open for this ticket (if anything) is
probably just the "not yet specified" deployment/runtime-environment
question from the map, not the auth/provisioning questions this ticket was
originally written around.

## Answer

Closed outright, not re-scoped. This ticket's entire premise (one DB per
(user, character), cloned from a template, with its own auth model) is
answered out of existence by ticket 10/ADR-0013: a Character exists
exactly once, ever, and access is a bearer-capability URL with no
user/account system anywhere. There is nothing left of the original
questions to answer.

The one item genuinely left over — the "not yet specified" deployment/
runtime-environment question the map deferred pending this ticket — was
split out to its own ticket rather than grafted onto this one, since its
title and framing no longer match anything about accounts or provisioning.
See [ticket 15](15-deployment-runtime-environment.md) and
[ADR-0014](../../../docs/adr/0014-home-network-deployment-manual-process-self-signed-tls.md).
