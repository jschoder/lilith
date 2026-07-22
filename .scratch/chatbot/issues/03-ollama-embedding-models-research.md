# Ollama-servable embedding models

Type: research
Status: resolved

## Question

What embedding models are servable locally via Ollama (e.g.
`nomic-embed-text`, `mxbai-embed-large`, `all-minilm`, others current as of
2026)? For each of the 2-3 most relevant candidates, capture:

- output embedding dimension
- approximate local inference cost/latency for short chat-message-length
  inputs
- licensing
- any known quality benchmarks relevant to semantic-similarity retrieval
  over conversational/memory text

Cross-reference against [ticket 02](02-turso-vector-search-research.md)'s
findings on Turso's vector column type — does the embedding dimension fit
comfortably, and are there practical limits on vector size worth knowing?
This feeds [ticket 05](05-memory-compression-pipeline.md). Capture sources.

## Answer

Full findings: [../research/03-ollama-embedding-models.md](../research/03-ollama-embedding-models.md).

Surveyed Ollama's embedding-model library (12 models tagged `embedding`)
and deep-dove the three most relevant for short conversational/memory text:
`nomic-embed-text` (v1.5, 768-dim, 137M params, Apache-2.0, 78.9M pulls),
`mxbai-embed-large` (v1, 1024-dim, 335M params, Apache-2.0, best STS score
of the three at 85.00), and `all-minilm` (384-dim, 22.7M params,
Apache-2.0, fastest but weakest STS at 78.95). All specs (dimension,
context window, license) were cross-verified via `ollama show -v`/
`--license` against locally pulled artifacts, not just Ollama's web pages
(which surface neither license nor dimension). Empirical local latency for
a ~20-word message on one GPU dev machine: ~20-40ms across all three;
no first-party latency figures exist from Ollama, Nomic, or MixedBread.

**Turso cross-reference**: ticket 02's `F32_BLOB(D)` column caps at 65,536
dims; all three candidates use under 2% of that (384/768/1024 dims =
1.5–4KB per vector) — no dimension-fit concern, and dimension doesn't
affect ticket 02's recommendation to skip the DiskANN index at this
project's scale.

**Recommendation**: `nomic-embed-text` as the default (best
license/size/battle-testing/Matryoshka-flexibility balance), `mxbai-embed-large`
as a quality-upgrade path if retrieval quality matters more than footprint,
`all-minilm` only as a fallback for hardware-constrained deployments.
