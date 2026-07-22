# libSQL/Turso native vector search

Type: research
Status: resolved

## Question

Does libSQL/Turso support native vector search, and if so:

- What's the column type for storing embeddings (e.g. `F32_BLOB`)?
- What distance/similarity functions are available (cosine, L2, dot
  product), and how are they invoked in SQL?
- Is there an index type for approximate nearest-neighbor search, and does
  it work well at the scale of a single local per-character database file
  (thousands to low tens-of-thousands of memory rows), or is it designed
  for much larger, server-hosted datasets?
- Any known limitations relevant to a per-character embedded/local file
  deployment (vs. Turso's hosted/remote offering)?

This feeds [ticket 05](05-memory-compression-pipeline.md) (how memories are
stored) and [ticket 06](06-memory-retrieval-scoring.md) (how they're
retrieved). Capture concrete SQL examples and current (2026) API surface,
with sources.

## Answer

Full findings: [../research/02-turso-vector-search.md](../research/02-turso-vector-search.md).

Yes, native vector search is real, but "libSQL/Turso" is now two codebases
that must be told apart: **libSQL** (the mature C fork that also powers
Turso Cloud) has full, shipped vector support including an ANN index;
**Turso Database** (the newer Rust rewrite) is still beta and only has
exact/brute-force vector search, with ANN indexing still on its backlog —
use libSQL specifically (official `@libsql/client`/`libsql-client-py`/
`libsql` crate, not a `turso`-branded package). Embeddings are stored in an
`F32_BLOB(D)` column (`CREATE TABLE t (embedding F32_BLOB(1536))`), built
via `vector32('[...]')`. Distance functions are plain scalar SQL functions —
`vector_distance_cos`, `vector_distance_l2`, and `vector_distance_dot` (plus
`vector_distance_jaccard` for sparse vectors) — usable directly in
`ORDER BY`. An ANN index exists (`CREATE INDEX ... ON t (libsql_vector_idx(embedding, 'metric=cosine'))`,
queried explicitly via `vector_top_k(idx, query_vec, k)` since the planner
does *not* use it automatically), built on a DiskANN variant — but it's
designed for datasets too large to brute-force, not for this project's
scale. Turso's own docs say a full unindexed scan stays acceptable up to
~10,000 vectors, and two independent reports (a source-code comment plus a
real-world GitHub issue) show the DiskANN index inflating on-disk size
10–50× at far smaller scales than that. **Recommendation**: for the
per-character local file (thousands to low tens-of-thousands of rows), skip
the ANN index entirely — use libSQL's `F32_BLOB` column with a plain
`ORDER BY vector_distance_cos(...) LIMIT k` scan, which is exact (perfect
recall) and fast enough at this scale per Turso's own guidance, and only
reconsider `libsql_vector_idx` if a specific character's memory table is
later profiled and found to actually need it. No vector feature was found
that's hosted-only or withheld from local/embedded libSQL files; the real
local-deployment risk is accidentally depending on the wrong package (Turso
Database instead of libSQL) or an unofficial local-SQLite binding, not a
capability gap in libSQL itself.
