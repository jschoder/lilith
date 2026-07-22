# libSQL/Turso native vector search: survey

Findings for [issue 02](../issues/02-turso-vector-search-research.md). Feeds
[ticket 05](../issues/05-memory-compression-pipeline.md) (how memories are
stored) and [ticket 06](../issues/06-memory-retrieval-scoring.md) (how they're
retrieved).

## Question recap

Does libSQL/Turso support native vector search, and if so:

1. What's the column type for storing embeddings (e.g. `F32_BLOB`)?
2. What distance/similarity functions are available (cosine, L2, dot
   product), and how are they invoked in SQL?
3. Is there an index type for approximate nearest-neighbor search, and does
   it work well at the scale of a single local per-character database file
   (thousands to low tens-of-thousands of rows), or is it designed for
   much larger, server-hosted datasets?
4. Any known limitations relevant to a per-character embedded/local file
   deployment (vs. Turso's hosted/remote offering)?

**A naming disambiguation is required before answering, because it changes
the answer to (3) and (4):** as of 2026, "Turso" refers to two different
codebases that both ship under the tursodatabase org, at different maturity
levels for vector search:

- **libSQL** ([tursodatabase/libsql](https://github.com/tursodatabase/libsql)) —
  Turso's C fork of SQLite. Production-ready, and the engine that currently
  powers Turso Cloud. This is where native vector search, including the
  DiskANN-based ANN index, actually lives and is mature.
- **Turso Database** ([tursodatabase/turso](https://github.com/tursodatabase/turso)) —
  a from-scratch Rust rewrite of SQLite, explicitly the company's long-term
  direction but still in **beta** (v0.7.0 as of July 13, 2026, pre-1.0). Its
  README lists vector support as "exact search and vector manipulation" only,
  with "Vector indexing for fast approximate vector search, similar to libSQL
  vector search" still on the roadmap, not shipped
  ([README, tursodatabase/turso](https://github.com/tursodatabase/turso)).
  A tracking issue to port libSQL's DiskANN C code to Rust
  ([tursodatabase/turso#832](https://github.com/tursodatabase/turso/issues/832),
  opened Jan 30, 2025) is still open and unassigned to a milestone
  ("Backlog"). A Nov 2025 release (sparse-vector inverted indexing, see §5)
  shows active movement on the Rust side, but as of this research it targets
  sparse/Jaccard search specifically and sits behind an
  `--experimental-index-method` flag, not a general dense-vector ANN
  replacement for DiskANN.

Since this project's per-character store is an embedded/local SQLite-style
file (not Turso Cloud), and confirmed via [Pekka Enberg's public summary](https://x.com/penberg/status/2032373944007688226)
("libSQL is our open-source fork of SQLite, which powers Turso Cloud... Turso
[Database] is a new SQLite-compatible database, rewritten from scratch in
Rust, currently in beta"), **the rest of this document evaluates libSQL**
(the C fork, e.g. via `@libsql/client`/`libsql-client-py`/`libsql` (Rust)
pointed at a `file:` URL with no `syncUrl`) as the relevant target — it is
the only one of the two with a shipped, documented ANN index today.

---

## 1. Does libSQL support native vector search?

Yes. Vector search ships as a first-class part of the SQL engine itself —
"no extensions are required" — and works identically whether the database
is a plain local file or a Turso Cloud connection, per Turso's own vector
landing page: `createClient({ url: 'file:local.db' })` is used as the
canonical local-file example
([turso.tech/vector](https://turso.tech/vector)). This was announced as a
new libSQL capability in
["Turso brings Native Vector Search to SQLite"](https://turso.tech/blog/turso-brings-native-vector-search-to-sqlite)
(dated June 5, 2024 in the fetched copy, where it's described as "in BETA");
by October 2024 the feature had reached general availability per subsequent
coverage, and it remains a documented, stable part of libSQL through 2026
(current reference: [docs.turso.tech/features/ai-and-embeddings](https://docs.turso.tech/features/ai-and-embeddings)
and [docs.turso.tech/guides/vector-search](https://docs.turso.tech/guides/vector-search),
neither of which carries beta language today).

---

## 2. Column type for storing embeddings

libSQL adds a family of vector-typed columns, all physically stored as
`BLOB` but with a declared type libSQL's parser recognizes to enable
dimension-checking and index eligibility (per
[docs.turso.tech/features/ai-and-embeddings](https://docs.turso.tech/features/ai-and-embeddings)):

| Declared type | Alt. name | Storage per vector |
|---|---|---|
| `FLOAT32` | `F32_BLOB(D)` | 4×D bytes |
| `FLOAT64` | `F64_BLOB(D)` | 8×D + 1 bytes |
| `FLOAT16` | `F16_BLOB(D)` | 2×D + 1 bytes |
| `FLOATB16` (bfloat16) | `FB16_BLOB(D)` | 2×D + 1 bytes |
| `FLOAT8` (libSQL-specific 8-bit compression) | `F8_BLOB(D)` | D + 14 bytes |
| `FLOAT1BIT` (1-bit packing) | `F1BIT_BLOB(D)` | ⌈D/8⌉ + 3 bytes |

`D` is the fixed dimensionality, declared in parentheses. Docs recommend
`F32_BLOB` ("the `FLOAT32` type should be a good starting point") as the
default for typical embedding models. Maximum dimensionality is capped at
65,536 ([docs.turso.tech/features/ai-and-embeddings](https://docs.turso.tech/features/ai-and-embeddings)).

```sql
CREATE TABLE memories (
    id      INTEGER PRIMARY KEY,
    content TEXT,
    embedding F32_BLOB(1536)   -- e.g. an OpenAI-shaped or local-model embedding width
);
```

Turso's own marketing page and the ai-and-embeddings reference both use this
`F32_BLOB(N)` form as the canonical declaration
([turso.tech/vector](https://turso.tech/vector);
[docs.turso.tech/features/ai-and-embeddings](https://docs.turso.tech/features/ai-and-embeddings)).
Note: `docs.turso.tech/guides/vector-search` shows one example with a plain
`embedding BLOB` column instead — since SQLite doesn't enforce declared
types at the storage layer, a plain `BLOB` column will still physically
hold a vector produced by `vector32()`, but the `F32_BLOB(N)`-style
declaration is what the two other primary references document as intended
usage and is required for libSQL's index/type-checking machinery to
recognize the column as a vector column of a known width — use `F32_BLOB(N)`,
not plain `BLOB`.

**Sparse vectors**: a separate `vector32_sparse` type/function pair exists
for high-dimensional, mostly-zero embeddings, storing only non-zero
values+indices for 5–50× space savings over dense storage
([docs.turso.tech/guides/vector-search](https://docs.turso.tech/guides/vector-search);
[turso.tech/blog/indexing-sparse-vectors-with-turso](https://turso.tech/blog/indexing-sparse-vectors-with-turso),
Nov 5, 2025). Not relevant unless the embedding model itself produces sparse
vectors (e.g. SPLADE-style), which a typical dense sentence-embedding model
does not.

---

## 3. Distance/similarity functions

All are plain scalar SQL functions taking two same-type, same-dimension
vectors and returning a `DOUBLE`, documented at
[docs.turso.tech/guides/vector-search](https://docs.turso.tech/guides/vector-search)
and [docs.turso.tech/features/ai-and-embeddings](https://docs.turso.tech/features/ai-and-embeddings):

```sql
-- Build a vector literal from JSON text (vector32 is the F32 constructor;
-- `vector` is documented as an alias for vector32)
vector32('[0.1, 0.2, 0.3]')

-- Cosine distance: range [0, 2], 0 = identical direction. Best default
-- for text embeddings.
vector_distance_cos(embedding, vector32('[0.25, 0.55, 0.15]'))

-- Euclidean (L2) distance. Not supported for FLOAT1BIT vectors.
vector_distance_l2(embedding, vector32('[0.25, 0.55, 0.15]'))

-- Dot product (returned as a negated value, so lower = more similar,
-- consistent with the other two functions where lower = closer)
vector_distance_dot(embedding, vector32('[0.25, 0.55, 0.15]'))

-- Weighted Jaccard distance — sparse vectors only
vector_distance_jaccard(embedding, vector32_sparse('[0.0, 1.0, 0.0, 2.0]'))

-- Round-trip a stored vector back to JSON text
vector_extract(embedding)
```

Unindexed/brute-force nearest-neighbor query (exact, full scan):

```sql
SELECT id, content
FROM memories
ORDER BY vector_distance_cos(embedding, vector32('[0.1, 0.2, 0.3]'))
LIMIT 10;
```

This is the "no index needed" path Turso's own marketing copy calls out
explicitly: "exact neighbor search without needing an index" is supported
([turso.tech/vector](https://turso.tech/vector)).

---

## 4. ANN index type: does one exist, and how is it invoked?

Yes — libSQL implements **LM-DiskANN** (Pan, 2023), a low-memory-footprint
variant of Microsoft's DiskANN graph-based ANN algorithm, integrated
directly into SQLite's query planner via a dedicated `OP_OpenVectorIdx`
bytecode instruction
([turso.tech/blog/approximate-nearest-neighbor-search-with-diskann-in-libsql](https://turso.tech/blog/approximate-nearest-neighbor-search-with-diskann-in-libsql)).
Source lives at
[`libsql-sqlite3/src/vectordiskann.c`](https://github.com/tursodatabase/libsql/blob/main/libsql-sqlite3/src/vectordiskann.c)
in the libSQL repo.

### Index creation

```sql
-- Minimal form — defaults to cosine metric
CREATE INDEX memories_idx ON memories (libsql_vector_idx(embedding));

-- With explicit options (variadic string params after the column)
CREATE INDEX memories_idx
ON memories (libsql_vector_idx(embedding, 'metric=cosine', 'compress_neighbors=float8'));
```

Index parameters, per
[docs.turso.tech/features/ai-and-embeddings](https://docs.turso.tech/features/ai-and-embeddings):

| Setting | Values | Default |
|---|---|---|
| `metric` | `cosine` \| `l2` | `cosine` |
| `max_neighbors` | positive integer | `3·√D` (D = vector dims) |
| `compress_neighbors` | `float1bit`\|`float8`\|`float16`\|`floatb16`\|`float32` | none |
| `alpha` | float ≥ 1 | 1.2 |
| `search_l` | positive integer | 200 |
| `insert_l` | positive integer | 70 |

Indexes require the table to have a `ROWID` or a single-column
`PRIMARY KEY` (no bare composite-key tables)
([docs.turso.tech/features/ai-and-embeddings](https://docs.turso.tech/features/ai-and-embeddings)).
Creating the index on a table that already has rows automatically backfills
it from existing data (same source).

### Querying the index

**Important gotcha, sourced from the same page**: the planner does *not*
automatically rewrite a plain `ORDER BY vector_distance_cos(...) LIMIT k`
into an index lookup — "using the index is not automatic, since it is
internally represented as a different table." You must call the special
table-valued function explicitly:

```sql
SELECT m.id, m.content
FROM vector_top_k('memories_idx', vector32('[0.1, 0.2, 0.3]'), 10) AS v
JOIN memories AS m ON m.rowid = v.id;
```

or, per the alternate form shown in Turso's own DiskANN announcement post:

```sql
SELECT id, content FROM memories
WHERE rowid IN vector_top_k('memories_idx', vector32('[0.1, 0.2, 0.3]'), 10);
```

### Algorithm design and why it exists

DiskANN-family algorithms exist specifically for "huge datasets of large
embeddings for retrieval-augmented generation" that don't fit in memory
([turso.tech/blog/approximate-nearest-neighbor-search-with-diskann-in-libsql](https://turso.tech/blog/approximate-nearest-neighbor-search-with-diskann-in-libsql)).
LM-DiskANN's specific trade-off vs. vanilla DiskANN is that it stores
**both** the graph *and* compressed neighbor vectors on disk (vanilla
DiskANN keeps compressed vectors in memory), trading additional disk usage
for a smaller memory footprint — the source comment for the neighbor-count
default is explicit about this being a deliberate, generous trade-off: "even
with 1MB we can store tens of thousands of nodes in several GBs — which is
already too much but we are 'generous' here," and separately states the
`3·√D`-neighbor default is chosen to hit "90%+ recall" while capping "disk
overhead at a moderate level — 50x of the disk size increase is the current
upper bound"
([`vectordiskann.c`](https://github.com/tursodatabase/libsql/blob/main/libsql-sqlite3/src/vectordiskann.c)).

---

## 5. Suitability at thousands–to–tens-of-thousands-of-rows scale

Three independent, corroborating primary/near-primary sources point the
same direction: **the DiskANN index is designed for, and only pays off at,
scales well beyond a single per-character local file — at this project's
row counts, the index is a net cost, not a benefit.**

1. **Turso's own guidance on when you need an index at all.** The original
   feature announcement states plainly that unindexed, exact full-table
   scans remain "acceptable" for datasets "until around 10,000 vectors"
   ([turso.tech/blog/turso-brings-native-vector-search-to-sqlite](https://turso.tech/blog/turso-brings-native-vector-search-to-sqlite)).
   A single character's memory store — "thousands to low tens-of-thousands
   of rows" per this ticket — sits almost entirely inside or right at the
   edge of that "just do a linear scan" band.

2. **Real-world disk-overhead report.** A user on the newer Rust rewrite's
   tracker, describing their experience specifically with *libSQL's*
   DiskANN index (not the Rust rewrite), reported the index alone grew a
   117 MiB vector dataset to **5 GiB on disk** — roughly a 43× blow-up —
   and argued that brute-force SIMD search would serve "95% of your users"
   better than DiskANN
   ([tursodatabase/turso#3778](https://github.com/tursodatabase/turso/issues/3778),
   opened Oct 19, 2025). This lines up almost exactly with the "50x disk
   size increase is the current upper bound" figure documented directly in
   the index's own source comments (§4) — it is not an outlier bug report,
   it is the algorithm behaving as designed.

3. **Independent space-complexity benchmark.** A third-party technical
   write-up building on libSQL's vector index measured a **3.5 MB → 50 MB**
   database growth after adding a DiskANN index (19 MB attributable to the
   index itself) on 512-dim vectors, at under 1,000 rows, and separately
   found that aggressive index-shrinking (`compress_neighbors=float8` +
   `max_neighbors=20`) cut the index 8× (19.7 MB → 2.4 MB) with **no
   observable recall difference** at their (sub-10K-row) scale, explicitly
   noting the difference would only start to matter "at 10,000+" rows
   ([turso.tech/blog/the-space-complexity-of-vector-indexes-in-libsql](https://turso.tech/blog/the-space-complexity-of-vector-indexes-in-libsql)).

**Conclusion for this ticket's scale**: DiskANN's entire value proposition —
trading disk space for sublinear query time on datasets too large to
brute-force — doesn't activate at thousands-to-tens-of-thousands of rows.
At that size, an exact linear scan (`ORDER BY vector_distance_cos(...)
LIMIT k`, no index) is both fast enough per Turso's own stated 10K-vector
threshold, and avoids DiskANN's characteristic 10–50× on-disk size
multiplier on a file that's supposed to stay a lightweight
per-character artifact. If growth ever pushes a single character's memory
table past the tens-of-thousands mark, the index remains available as a
drop-in addition (`CREATE INDEX ... libsql_vector_idx(...)`) without a
schema change, and `compress_neighbors=float8`/reduced `max_neighbors` are
documented levers to shrink it if adopted.

---

## 6. Limitations specific to embedded/local-file deployment vs. Turso's hosted offering

- **Feature parity is real and confirmed, but codebase choice matters.**
  libSQL's vector functions and DiskANN index are compiled directly into
  the SQLite core libSQL ships, so a purely local file (`file:local.db`,
  no `syncUrl`, no network) gets full, offline feature parity with Turso
  Cloud — this is explicitly demonstrated in Turso's own marketing example
  using a local file URL ([turso.tech/vector](https://turso.tech/vector)).
  The limitation is not "local libSQL lacks features Turso Cloud has" — it's
  the naming trap in §0: if this project (or its dependencies/tooling) ever
  drifts onto **Turso Database** (the Rust rewrite, `tursodatabase/turso`,
  distinct package/binary from libSQL) instead of libSQL, ANN indexing is
  simply not there yet — only exact/brute-force search and sparse-vector
  inverted indexing (behind an experimental flag) are shipped as of this
  research ([README, tursodatabase/turso](https://github.com/tursodatabase/turso);
  [tursodatabase/turso#832](https://github.com/tursodatabase/turso/issues/832)).
  Action item: pin the dependency explicitly to the libSQL client packages
  (`@libsql/client`, `libsql-client-py`, or the `libsql` Rust crate) rather
  than any `turso`-named package, and confirm at implementation time which
  engine a given SDK version actually embeds.

- **The DiskANN index-not-used-automatically gotcha (§4) applies identically
  local or hosted** — it's a query-planner behavior, not a
  deployment-mode difference, but it's easy to miss if a developer used to
  ordinary SQLite indexes assumes `ORDER BY vector_distance_cos(...) LIMIT k`
  will use an index the way `ORDER BY indexed_col LIMIT k` would.

- **Driver/binding-level rough edges have been reported specifically in
  local/embedded configurations.** An open (unresolved as of this research)
  libSQL issue describes vector embeddings silently failing to persist
  (returned as empty arrays) when using libSQL through Drizzle ORM with
  `op-sqlite` in an Expo/React Native local-database setup, using
  `F32_BLOB(512)` + `vector32()` exactly as documented
  ([tursodatabase/libsql#1903](https://github.com/tursodatabase/libsql/issues/1903),
  opened Jan 4, 2025, no maintainer response as of this research). This
  isn't a core libSQL/DiskANN defect — it implicates a third-party
  binding/ORM layer — but it's a concrete, citable data point that
  local-mode vector usage through non-official bindings has had rough
  edges in the wild; a Node/TS backend using the official `@libsql/client`
  package directly (rather than a community SQLite binding) is the safer
  path and matches what this project's stack already calls for.

- **No hosted-only vector feature was found that's withheld from local
  files.** Everything cross-checked in this research (column types,
  distance functions, `libsql_vector_idx`, `vector_top_k`) is documented
  as core libSQL/SQLite-engine behavior, not a Turso Cloud service-layer
  add-on. The only genuinely hosted-specific caveat found in adjacent
  material is unrelated to vector search itself (a beta "concurrent writes"
  feature gated to Turso Cloud, mentioned in passing on
  [turso.tech/vector](https://turso.tech/vector)) — not a vector-search
  limitation.

---

## Recommendation

**Use libSQL's native vector support (not the Turso Database Rust
rewrite) for the per-character local file, and skip the DiskANN ANN index
at this project's scale:**

- Store embeddings in an `F32_BLOB(D)` column (§2); build vectors with
  `vector32('[...]')`; the primary embedding-similarity function should be
  `vector_distance_cos` unless the embedding model's own documentation
  recommends L2 or dot product for that specific model (§3).
- **Do not create a `libsql_vector_idx` index by default.** At "thousands to
  low tens-of-thousands of rows" per character, Turso's own stated
  10,000-vector full-scan-is-fine threshold (§5, source 1) plus two
  independent reports of 10–50× on-disk bloat from the same index (§5,
  sources 2–3) mean the index actively works against this project's design
  goal of a lightweight, portable per-character file. Use a plain
  `ORDER BY vector_distance_cos(embedding, :query) LIMIT :k` scan instead —
  exact recall, no index-maintenance cost, and demonstrably fast enough at
  this scale per Turso's own guidance.
- Revisit the index only if empirical profiling on a real character's grown
  memory table shows the linear scan becoming a bottleneck — at that point
  `CREATE INDEX ... libsql_vector_idx(embedding, 'compress_neighbors=float8')`
  is a schema-compatible drop-in, not a redesign.
- Depend on the official libSQL client packages specifically (not any
  `turso`-branded package) to avoid accidentally landing on the Rust
  rewrite, which doesn't yet ship ANN indexing and is still pre-1.0 beta.

This directly informs [ticket 05](../issues/05-memory-compression-pipeline.md)
(embeddings can be stored inline as `F32_BLOB` alongside compressed memory
rows, no separate vector store needed) and
[ticket 06](../issues/06-memory-retrieval-scoring.md) (retrieval scoring can
rely on `vector_distance_cos` in a plain `ORDER BY ... LIMIT` query rather
than needing to design around ANN-index approximate-recall trade-offs).

---

## References

- ["AI & Embeddings" — Turso docs](https://docs.turso.tech/features/ai-and-embeddings) —
  primary reference for column types, function signatures, index parameters,
  dimensionality limit, ROWID requirement.
- ["Vector Search" guide — Turso docs](https://docs.turso.tech/guides/vector-search) —
  primary reference for `vector_distance_dot`, `vector_distance_jaccard`,
  sparse vector functions, `vector_extract`/`vector_concat`/`vector_slice`,
  and the "linear scan" default-behavior note.
- ["libSQL" overview — Turso docs](https://docs.turso.tech/libsql) —
  primary source for the libSQL-vs-Turso-Database relationship and
  Turso Cloud's current dependency on libSQL.
- [turso.tech/vector — "Native Vector Search for SQLite"](https://turso.tech/vector) —
  primary marketing/reference page; source for the `file:local.db` local-mode
  example and the "exact neighbor search without needing an index" note.
- ["Turso brings Native Vector Search to SQLite" — Turso blog](https://turso.tech/blog/turso-brings-native-vector-search-to-sqlite) —
  original feature announcement (June 2024 per fetched copy); source for
  the "~10,000 vectors" full-scan-acceptable guidance and original beta
  status language.
- ["Approximate nearest neighbor search with DiskANN in libSQL" — Turso blog](https://turso.tech/blog/approximate-nearest-neighbor-search-with-diskann-in-libsql) —
  primary source for the LM-DiskANN algorithm choice, `OP_OpenVectorIdx`
  bytecode integration, and the "index not used automatically" query
  pattern.
- ["The space complexity of vector indexes in LibSQL" — Turso blog](https://turso.tech/blog/the-space-complexity-of-vector-indexes-in-libsql) —
  primary source for the 3.5MB→50MB / 19MB-index and 8×-compression
  benchmark numbers at sub-1,000-row scale.
- ["Indexing sparse vectors with Turso" — Turso blog](https://turso.tech/blog/indexing-sparse-vectors-with-turso) —
  primary source for sparse-vector inverted indexing (Turso 0.3.0, Nov 5,
  2025) and its `--experimental-index-method` gating.
- [`libsql-sqlite3/src/vectordiskann.c` — tursodatabase/libsql (GitHub, `main`)](https://github.com/tursodatabase/libsql/blob/main/libsql-sqlite3/src/vectordiskann.c) —
  primary source for the DiskANN index implementation, `3·√D` neighbor
  default, and the "50x disk size increase is the current upper bound"
  design comment.
- [tursodatabase/turso — README (GitHub)](https://github.com/tursodatabase/turso) —
  primary source for Turso Database's (Rust rewrite) current version
  (v0.7.0, July 13, 2026), pre-1.0/beta status, and vector-feature gap vs.
  libSQL.
- [tursodatabase/turso#832 — "Vector search with DiskANN"](https://github.com/tursodatabase/turso/issues/832) —
  primary source confirming DiskANN porting to the Rust rewrite is
  open/backlog, not shipped (opened Jan 30, 2025).
- [tursodatabase/turso#3778 — "Suggestion for Vector Search: ... SIMD-accelerated brute-force search"](https://github.com/tursodatabase/turso/issues/3778) —
  primary source for the real-world 117MiB→5GiB DiskANN disk-overhead
  report (opened Oct 19, 2025).
- [tursodatabase/libsql#1903 — "Unable to insert vector data libsql"](https://github.com/tursodatabase/libsql/issues/1903) —
  primary source for the local/embedded (op-sqlite + Drizzle + Expo)
  vector-persistence bug report (opened Jan 4, 2025, unresolved).
- [Pekka Enberg (Turso co-founder), public post disambiguating Turso Cloud / libSQL / Turso Database](https://x.com/penberg/status/2032373944007688226) —
  used only to corroborate the libSQL-vs-Turso-Database relationship
  already stated in the official docs; not relied on for any fact not also
  in a docs/source citation above.

## Not pursued further

- **WASM/browser-embedded libSQL vector support** — out of scope; this
  project's per-character file is server/Node-side, not browser-embedded.
- **Full benchmark reproduction** (actually building a test character DB and
  measuring linear-scan latency at 10K/30K rows) — recommended as a cheap
  `/prototype` follow-up before ticket 06 finalizes retrieval scoring, but
  not done here since the documented ~10,000-vector guidance plus two
  independent index-overhead reports were judged sufficient to answer this
  ticket's question without needing to reproduce the benchmark first-hand.
