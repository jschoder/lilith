# Deployment / runtime environment

Type: grilling
Status: resolved

Blocked by: 11

## Question

The map's "Not yet specified" list carried this since the start: deployment
target for the multi-user case (Docker? bare metal? where does it run
remotely?), deferred until the auth/DB-provisioning decision
([ticket 11](11-multi-user-auth-db-provisioning.md)) landed. Ticket 11
resolved by dissolving into ticket 10/ADR-0013 (no accounts, capability
URL), which leaves this ticket to answer the actual remaining questions:

- Does dropping accounts/multi-user also mean dropping remote access, or do
  they stay independent?
- Given the capability URL is the entire access-control mechanism, what
  transport security does it need, and is that ever optional?
- Where does this actually run, and how is it exposed to the outside
  network (if at all)?
- Does a leaked capability URL need to be revocable?
- How is the process run and kept alive — containerized, supervised, or
  manual?

## Answer

**Remote access stays in scope**, independent of the accounts question —
a capability URL works identically whether the request originates on the
LAN or from outside it, so dropping accounts didn't imply dropping remote
reachability.

**TLS is mandatory, unconditionally, including on LAN** — no
plaintext-HTTP mode exists. Since the capability URL is itself the bearer
credential, an HTTP fallback would be a silent security downgrade of
exactly the kind this project's "no fallbacks" stance rules out elsewhere.

**Runs on a personal machine on the operator's own network** (not
necessarily the same box as the client) — a consequence of Ollama needing
local GPU access, not a hosting preference. Public reachability (a router
port-forward to the outside internet) is gated by a required env var that
selects the server's bind address (public vs. loopback/LAN-only); missing
env var crashes on boot rather than defaulting either way.

**No revocation/rotation mechanism for a leaked capability URL** — accepted
as an explicit, documented gap rather than solved now. The Character ID
doubles as both storage key and access credential (ADR-0013); decoupling
them to support rotation would be a real redesign, not a quick add, and
isn't justified yet given the small/trusted self-hosted user base.

**TLS certificate is self-signed for now**, accepted via browser
Trust-On-First-Use pinning rather than a CA-issued cert — this avoids
publishing the deployment's hostname to public Certificate Transparency
logs, at the cost of a first-use-per-device MITM window and manual
(non-automatic) renewal. Upgrading to a CA-issued cert (e.g. Let's Encrypt
+ Dynamic DNS) later is a documented, drop-in upgrade path — nothing else
in the design depends on which kind of cert is in use.

**The Node/TS backend terminates TLS directly** — no reverse proxy in
front, since a proxy's main draw (automatic Let's Encrypt provisioning)
doesn't apply to a self-signed cert and there's no load-balancing or
multi-backend routing need.

**No Docker, no process supervisor** — both Ollama and the Node backend
are started manually from the command line only while the system is
actually being used, not run as an always-on service. A single personal
machine with no portability requirement gets nothing from
containerization or auto-restart automation.

See [ADR-0014](../../../docs/adr/0014-home-network-deployment-manual-process-self-signed-tls.md).
