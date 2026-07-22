# Home-network deployment: manual process, mandatory TLS, self-signed for now

The server runs on a personal machine on the operator's own network — driven
by Ollama needing local GPU access, not a preference about hosting style —
and is started manually from the command line alongside Ollama, only while
the system is actually being used. There is no process supervisor, no
Docker, and no always-on service: a single personal machine with no
portability requirement gets nothing from containerization or crash-recovery
automation that a manual restart doesn't already cover.

Remote access (reaching the server from outside the home network) stays in
scope — dropping accounts (ADR-0013) didn't mean dropping remote
reachability, since a capability URL works identically regardless of where
the request originates. But because the capability URL *is* the entire
access-control mechanism, TLS is mandatory unconditionally, including on
LAN — a bearer-capability scheme with a plaintext-HTTP mode is a silent
security downgrade of exactly the kind this project's "no fallbacks"
stance rules out elsewhere. The Node/TS backend terminates TLS itself
(no reverse proxy); public reachability is gated by a required env var
that selects the bind address (public vs. loopback/LAN-only), crashing on
boot if unset rather than defaulting to either side.

The TLS certificate is self-signed for now, accepted via browser
Trust-On-First-Use pinning (Firefox and similar pin the specific
certificate fingerprint per origin on first accept, not "any self-signed
cert"). This avoids publishing the deployment's hostname to public
Certificate Transparency logs the way a CA-issued cert (e.g. Let's
Encrypt) would, which matters for a home server whose whole point is
staying unremarkable to internet-wide scanners. The tradeoff is a
first-use MITM window per browser/device, and no automatic renewal — an
acceptable cost given the actual usage pattern (a handful of the
operator's own devices, first use typically happening on the trusted home
network). Nothing else in the design depends on which kind of certificate
is in use, so upgrading to a CA-issued cert later is a drop-in change.

## Considered options

- **Reverse proxy (Caddy/nginx/Traefik) terminating TLS.** Rejected: the
  main draw of a proxy like Caddy is automatic Let's Encrypt provisioning,
  which doesn't apply to a self-signed cert; running a second process buys
  nothing here since there's no load-balancing or multi-backend routing
  need.
- **Docker / systemd / any process supervisor.** Rejected: this runs on
  exactly one machine the operator already controls, started manually
  alongside Ollama only during active use — there's no deployment
  portability need and no benefit to auto-restart for a process that
  isn't meant to run unattended in the first place.
- **Let's Encrypt + Dynamic DNS now, instead of self-signed.** Rejected
  for now: it would avoid the TOFU first-use window, but publishes the
  hostname to public CT logs permanently (even during windows the server
  is otherwise not publicly exposed) and needs a stable DDNS hostname
  and renewal automation this deployment doesn't otherwise require. Left
  as the documented upgrade path if the CT-log tradeoff stops being
  acceptable.
- **Private overlay network (e.g. Tailscale) instead of a public port.**
  Rejected: adds a defense-in-depth layer, but the operator chose a
  public port gated by a kill-switch env var instead, keeping the
  network model simple (one flag) rather than introducing a mesh-VPN
  dependency.

## Consequences

- **No capability-URL revocation exists.** A leaked link grants
  permanent access with no way to cut it off short of deleting the
  Character outright (losing its entire memory/emotion history), since
  the Character ID doubles as both storage key and access credential
  per ADR-0013. This is an accepted, explicitly acknowledged gap, not a
  solved problem — revisit if the trust model here stops fitting (e.g.
  links start being shared outside a small trusted circle).
- Regenerating the self-signed certificate (expiry, key rotation)
  invalidates every device's pinned exception at once, reopening the
  first-use window everywhere simultaneously.
- If usage ever grows beyond "operator's own few devices" — e.g.
  capability links routinely opened from many outside people's
  browsers — the self-signed TOFU model's per-device first-use exposure
  stops being a narrow edge case and this decision should be revisited
  in favor of a CA-issued certificate.
