# 23 — Deployment: TLS, bind-address gating, manual start

**What to build:** The whole app (now feature-complete) can actually be run somewhere real — started manually on the operator's own machine alongside Ollama, reachable only where explicitly permitted, with TLS mandatory everywhere since the capability URL is the only credential in the system. Sequenced last so deployment is validated against the full, finished app rather than a partial slice.

**Blocked by:** 16, 17, 18, 19, 20, 21, 22

**Status:** ready-for-agent

- [ ] The Node backend terminates TLS directly with a self-signed certificate — no plaintext-HTTP mode exists anywhere, including on LAN.
- [ ] A required bind-address env var gates public vs. loopback/LAN-only reachability; the server crashes on boot if it's unset (no default).
- [ ] Documented manual start process brings up the server alongside a locally-running Ollama instance — no Docker image, process supervisor, or always-on service is introduced.
- [ ] A README/runbook note documents the browser TOFU-pinning step for the self-signed cert and the acknowledged gap that a leaked capability URL can't be revoked short of deleting the Character.
- [ ] A manual end-to-end smoke test against the full running app (creation → chat → emotion/avatar update → memory retrieval → goal lifecycle) is documented as the deployment verification step, since this layer is explicitly outside the automated test seams.
