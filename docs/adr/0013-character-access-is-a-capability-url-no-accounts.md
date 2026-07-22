# Character access is a capability URL, no accounts, no per-character cloning

A Character exists exactly once, ever — created via an empty `/chat/` form
and never cloned or templated per user. Access control is entirely a
bearer-capability URL: the Character ID is generated directly from a
CSPRNG at creation (never derived/hashed from any other input) and serves
as both the on-disk storage key and the `/chat/{id}` route; whoever holds
the link has full access, including sharing state with anyone they forward
it to. This is a deliberate simplification for a project not intended to
run on a public/multi-tenant server — no session or login system exists
anywhere, and it means ticket 11's original premise (one DB per
(user, character), cloned from a template, with its own auth model)
collapses to nothing beyond this.

## Considered Options

- Real user accounts with per-(user, character) DB cloning, as ticket 11
  originally framed it — rejected because it assumes a multi-tenant server
  model this project doesn't have; there is exactly one instance of each
  Character, so there is nothing to clone per user in the first place.
