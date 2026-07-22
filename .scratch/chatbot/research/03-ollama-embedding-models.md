# Ollama-servable embedding models: survey

Findings for [issue 03](../issues/03-ollama-embedding-models-research.md). Feeds
[ticket 05](../issues/05-memory-compression-pipeline.md) (how memories are
embedded and stored) and, via the Turso cross-reference below, confirms an
assumption [ticket 02](../issues/02-turso-vector-search-research.md)'s
findings depend on.

## Question recap

Which embedding models are servable locally via Ollama as of 2026? For the
2-3 most relevant candidates for embedding short (sentence-to-paragraph)
conversational/memory text for semantic-similarity retrieval: output
dimension, approximate local inference cost/latency, licensing, and quality
benchmarks relevant to STS/retrieval over short text — then cross-reference
dimension against ticket 02's Turso/libSQL `F32_BLOB(D)` findings.

---

## 0. What's in Ollama's embedding model library (as of this research)

Fetched from [ollama.com/search?c=embedding](https://ollama.com/search?c=embedding)
(accessed 2026-07-19). Ollama tags models with an `embedding` capability;
this is the full current list, with pull counts as a rough popularity signal:

| Model | Sizes | Pulls | One-line description (Ollama) |
|---|---|---|---|
| `nomic-embed-text` | 137m | 78.9M | "A high-performing open embedding model with a large token context window." |
| `mxbai-embed-large` | 335m | 12.7M | "State-of-the-art large embedding model from mixedbread.ai" |
| `all-minilm` | 22m, 33m | 3.3M | Trained on large sentence datasets |
| `snowflake-arctic-embed` | 22m–335m | 3.1M | Snowflake's embedding suite, "optimized for performance" |
| `qwen3-embedding` | 0.6b, 4b, 8b | 2.4M | Built on the Qwen3 model series |
| `bge-m3` | 567m | 5.2M | BAAI, multi-functionality/linguality/granularity |
| `paraphrase-multilingual` | 278m | 927.7K | Clustering / semantic search |
| `embeddinggemma` | 300m | 1.4M | Google's 300M-parameter embedding model |
| `snowflake-arctic-embed2` | 568m | 425.6K | Adds multilingual support |
| `granite-embedding` | 30m, 278m | 339.7K | IBM |
| `bge-large` | 335m | 275.4K | BAAI |
| `nomic-embed-text-v2-moe` | — | 530.3K | Multilingual MoE, retrieval-focused |

Source: [ollama.com/search?c=embedding](https://ollama.com/search?c=embedding),
accessed 2026-07-19. Pull counts are cumulative-since-listing, not
current-usage, but the three-order-of-magnitude gap between
`nomic-embed-text` (78.9M) and the smaller/newer entries is a reasonable
signal of production battle-testing, not just recency.

### Selection: `nomic-embed-text`, `mxbai-embed-large`, `all-minilm`

These three are the models picked for deep-dive below, for this project's
specific use case (short conversational/memory snippets, local self-hosted
inference, retrieval-style similarity search):

- **`nomic-embed-text`** — by far the most-pulled dedicated embedding model
  in Ollama's library (78.9M), Apache-2.0, and (per §2 below) its own
  first-party benchmark table shows negligible quality loss down to small
  Matryoshka dimensions — useful if storage/index size ever becomes a
  concern for the per-character `F32_BLOB` design ticket 02 recommends.
- **`mxbai-embed-large`** — the highest-quality/most benchmarked of the
  three (best MTEB average of the three, §2), still small enough (335M
  params, ~670MB) to run comfortably on CPU-only hardware, Apache-2.0.
  Reasonable pick if retrieval quality matters more than raw speed/footprint.
- **`all-minilm`** — smallest and cheapest by a wide margin (22M/33M
  params, 46-67MB), Apache-2.0, the lowest-risk choice if the deployment
  target is resource-constrained (e.g. a low-spec self-hosted box running
  the LLM and embedding model side by side).

**Not selected, and why**: `qwen3-embedding` and `embeddinggemma` are newer
(2025-era) and have real pull counts, but their smallest variants (0.6B,
300M) are still larger than `all-minilm` for comparable or unproven
incremental quality gain on *short* text specifically, and neither has the
multi-year production track record `nomic-embed-text`/`mxbai-embed-large`
have; `bge-m3`/`snowflake-arctic-embed` are optimized for
multilingual/document-scale retrieval, which isn't this project's
requirement (a companion chatbot's memory text is expected to be
single-language, short, conversational). None of these are ruled out for a
future revisit — just not the top 2-3 for this ticket's stated use case.

---

## 1. `nomic-embed-text` (v1.5)

### Output embedding dimension

**768** natively; supports **Matryoshka Representation Learning (MRL)**
truncation to 512, 256, 128, or 64 dims with a documented, small quality
cost (§ below). Confirmed three ways:
- Ollama's own served model metadata, read directly off the pulled model on
  this machine via `ollama show nomic-embed-text -v`: `embedding length 768`.
- The upstream Hugging Face config: `hidden_size: 768`
  ([huggingface.co/nomic-ai/nomic-embed-text-v1.5/raw/main/config.json](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5/raw/main/config.json)).
- The model card's own MRL table (§ below).

### Context window

Ollama serves it with **`num_ctx` 8192** by default (per `ollama show -v`),
even though the model's trained/native position-embedding ceiling is 2048
(`max_position_embeddings: 2048` in the HF config, and Ollama's own tags
page lists "2K context window" — [ollama.com/library/nomic-embed-text](https://ollama.com/library/nomic-embed-text),
tags tab, accessed 2026-07-19). This is consistent with the model's own
README, which documents an explicit RoPE-scaling recipe to extend past 2048
up to 8192 ([huggingface.co/nomic-ai/nomic-embed-text-v1.5](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5)).
Not a concern either way for this project: a chat-message-length input
(a sentence to a paragraph) is nowhere near either ceiling.

### Local inference cost/latency (short input)

- **Size/params**: 137M parameters, 274MB on disk (F16 GGUF) — from Ollama's
  tags page ([ollama.com/library/nomic-embed-text](https://ollama.com/library/nomic-embed-text))
  and confirmed via `ollama show -v` (`general.parameter_count:
  1.3672704e+08`).
- **Empirical measurement (this research, not a vendor-published figure)**:
  on a local dev machine (Intel i5-6600K, NVIDIA RTX 3060 12GB, Ollama
  0.20.4), embedding a realistic ~20-word chat message via
  `POST /api/embed` after model warm-load took **~20-40ms** end-to-end
  (wall-clock `curl` round-trip, GPU-accelerated, `ollama ps` confirmed
  "100% GPU"). This is illustrative of one machine, not a universal number —
  reported because neither Ollama nor Nomic publish an official
  latency/throughput figure for this model (searched Nomic's blog and the
  model's HF discussions; no first-party number found — see References).
  A community HF discussion on this model
  ([huggingface.co/nomic-ai/nomic-embed-text-v1.5/discussions/34](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5/discussions/34),
  titled "Slow inference performance...") flags CPU-only inference as
  noticeably slower than GPU — worth knowing if the deployment target has
  no GPU, though the discussion doesn't give exact CPU numbers either.
- At 137M params and 274MB, this is a small model by embedding-model
  standards — well under the size of even a small LLM — so CPU-only
  inference for a single short string is expected to be sub-second on
  ordinary server hardware, but this project should benchmark on its actual
  target deployment hardware before relying on a specific number.

### Licensing

**Apache License 2.0**, confirmed on two independent primary sources:
1. The Hugging Face model card frontmatter: `license: apache-2.0`
   ([huggingface.co/nomic-ai/nomic-embed-text-v1.5/raw/main/README.md](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5/raw/main/README.md)).
2. The **actual license text bundled with the Ollama-distributed model
   artifact itself**, read directly via `ollama show nomic-embed-text
   --license` after pulling the model locally — full Apache-2.0 license
   text, matching HF. (Ollama's web library page for this model does not
   surface a license tab/section at all as of this research — the
   in-artifact `ollama show --license` output and the HF repo are the two
   sources that actually contain license text.)

No discrepancy between Ollama's distributed artifact and the upstream HF
license for this model.

### Quality benchmarks (STS / retrieval, relevant to short-text similarity)

From the model's own card, which embeds a `model-index` of official MTEB
results ([huggingface.co/nomic-ai/nomic-embed-text-v1.5](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5)):

| Dimension (MRL) | MTEB avg (overall) |
|---|---|
| 768 (native) | 62.28 |
| 512 | 61.96 |
| 256 | 61.04 |
| 128 | 59.34 |
| 64 | 56.10 |

(For comparison, `nomic-embed-text-v1`, the predecessor, scores 62.39 at
768 — v1.5's headline feature is the MRL flexibility, not a v1→v1.5 quality
jump.) The model card states it "surpasses OpenAI `text-embedding-ada-002`
and `text-embedding-3-small` performance on short and long context tasks"
([ollama.com/library/nomic-embed-text](https://ollama.com/library/nomic-embed-text)
model description, and the HF README's own framing). The technical report
([Nussbaum et al., "Nomic Embed: Training a Reproducible Long Context Text
Embedder," arXiv:2402.01613](https://arxiv.org/abs/2402.01613)) is the
citable primary source for the MTEB methodology and training pipeline
behind these numbers.

---

## 2. `mxbai-embed-large` (v1)

### Output embedding dimension

**1024** natively, with Matryoshka-style truncation supported via a
`truncate_dim` parameter (README usage examples show a 512-dim example,
which is a *usage illustration*, not the native/default output size — this
is worth flagging since a naive read of the model card's code sample could
lead to assuming 512 is the default). Confirmed three ways:
- Ollama's own served model metadata: `embedding length 1024` (`ollama show
  mxbai-embed-large -v`, run against the locally pulled model).
- The upstream HF config: `hidden_size: 1024`
  ([huggingface.co/mixedbread-ai/mxbai-embed-large-v1/raw/main/config.json](https://huggingface.co/mixedbread-ai/mxbai-embed-large-v1/raw/main/config.json))
  and the SentenceTransformers pooling config:
  `word_embedding_dimension: 1024`
  ([.../1_Pooling/config.json](https://huggingface.co/mixedbread-ai/mxbai-embed-large-v1/raw/main/1_Pooling/config.json)).
- Ollama's tags page size (335m/670MB), consistent with a BERT-large-class
  (24-layer, 1024-hidden) architecture.

### Context window

**512 tokens** (`max_position_embeddings: 512` in the HF config; Ollama
serves `num_ctx 512` by default per `ollama show -v`, matching Ollama's
tags page "512 context window" listing). More than sufficient for a single
chat-message-length input.

### Local inference cost/latency (short input)

- **Size/params**: 334-335M parameters, 670MB on disk (F16 GGUF) — Ollama
  tags page and `ollama show -v` (`general.parameter_count` confirms
  ~335M-scale via the BERT-large architecture: 24 layers, hidden 1024, 16
  heads).
- **Empirical measurement (this research)**: same test setup as above
  (RTX 3060, Ollama 0.20.4, ~20-word chat message), **~30-40ms**
  end-to-end per request after warm-load — the slowest of the three models
  tested here, consistent with it having ~2.4x the parameters of
  `nomic-embed-text` and ~15x those of `all-minilm`, though the absolute
  gap is small (tens of milliseconds) at this model scale.
  MixedBread's own documentation does not publish first-party
  latency/throughput numbers for this model (checked
  [mixedbread.com/blog/mxbai-embed-large-v1](https://www.mixedbread.com/blog/mxbai-embed-large-v1)
  and the HF card; the blog post covers architecture and MTEB results, not
  latency).
- All three candidates in this survey are small enough (≤335M params, ≤1GB
  on disk) that none should meaningfully compete with an LLM's own
  inference cost for compute on the same box — the practical latency
  difference between the three, for one short string, is expected to be
  low tens of milliseconds on modest consumer hardware, and likely more on
  CPU-only hardware without a GPU.

### Licensing

**Apache License 2.0**, confirmed on two independent primary sources:
1. HF model card frontmatter: `license: apache-2.0`, and an explicit
   `## License` section in the README body stating "Apache 2.0"
   ([huggingface.co/mixedbread-ai/mxbai-embed-large-v1/raw/main/README.md](https://huggingface.co/mixedbread-ai/mxbai-embed-large-v1/raw/main/README.md)).
2. `ollama show mxbai-embed-large --license`, run against the locally
   pulled artifact — full Apache-2.0 text, matching HF. (As with
   `nomic-embed-text`, Ollama's web library page itself shows no license
   tab/section; the license only surfaces via the CLI against a pulled
   model, or via the upstream HF repo.)

No discrepancy between the Ollama-distributed artifact and upstream HF
license.

### Quality benchmarks (STS / retrieval)

The model card includes a full official MTEB comparison table (56
datasets) — read directly from the HF README
([huggingface.co/mixedbread-ai/mxbai-embed-large-v1](https://huggingface.co/mixedbread-ai/mxbai-embed-large-v1)):

| Model | Avg (56) | STS (10) | Retrieval (15) | Classification (12) |
|---|---|---|---|---|
| **mxbai-embed-large-v1** | **64.68** | **85.00** | **54.39** | 75.64 |
| bge-large-en-v1.5 | 64.23 | 83.11 | 54.29 | 75.97 |
| nomic-embed-text-v1 | 62.39 | 82.06 | 52.81 | 74.12 |
| OpenAI text-embedding-3-large | 64.58 | 81.73 | 55.44 | 75.45 |
| Cohere embed-english-v3.0 | 64.47 | 82.62 | 55.00 | 76.49 |

This is the highest STS score of the three models surveyed here (85.00 vs.
nomic-embed-text-v1's 82.06 in the same table), and the card explicitly
states it was trained "with no overlap of the MTEB data," offered as
evidence of generalization rather than benchmark overfitting ("As of March
2024, our model archives SOTA performance for Bert-large sized models on
the MTEB... outperforms commercial models like OpenAI's
text-embedding-3-large"). STS (semantic textual similarity) is the MTEB
subtask most directly analogous to this project's memory-recall use case
(scoring how similar two short text snippets are), making this model's
STS lead the single most relevant number in this table for the ticket's
question.

---

## 3. `all-minilm` (all-MiniLM-L6-v2)

### Output embedding dimension

**384**. Confirmed via:
- Ollama's own served model metadata: `embedding length 384` (`ollama show
  all-minilm -v`, against the locally pulled model — `bert.embedding_length
  384`).
- The upstream HF model card's own opening line: "This is a
  sentence-transformers model: It maps sentences & paragraphs to a **384
  dimensional** dense vector space"
  ([huggingface.co/sentence-transformers/all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)).

### Context window

**512 tokens** max (`bert.context_length 512` per `ollama show -v`), though
the HF card notes the model was *trained* with sequences limited to 128
tokens and truncates input longer than 256 word-pieces by default in the
sentence-transformers library. Ollama's own default `num_ctx` for this
model is **256**, the smallest default context of the three models
surveyed. None of this matters for a chat-message-length input, but it's
the tightest ceiling of the three if a memory snippet were ever
unexpectedly long (a multi-paragraph message, say) — worth knowing if the
project ever embeds longer text than a single chat message with this
specific model.

### Local inference cost/latency (short input)

- **Size/params**: by far the smallest of the three — 22.7M parameters
  ([HF card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)),
  46MB (22m tag) / 67MB (33m tag) on disk per Ollama's tags page. `ollama
  show -v` on the locally pulled model reports `general.parameter_count:
  2.2565376e+07` (~22.6M), a 6-layer, 384-hidden BERT variant.
- **Empirical measurement (this research)**: same test setup, **~20ms**
  end-to-end for the same ~20-word chat message, the fastest of the three
  models, and consistently the fastest across all repeated timing runs
  performed for this research (Ollama 0.20.4, RTX 3060).
- The sentence-transformers project's own pretrained-models documentation
  (the direct maintainer/publisher of this model architecture) states
  MiniLM-based models trade some quality for being "5 times faster" than
  their larger `all-mpnet-base-v2` model
  ([sbert.net/docs/sentence_transformer/pretrained_models.html](https://sbert.net/docs/sentence_transformer/pretrained_models.html)) —
  a first-party relative-speed claim, though not an absolute
  millisecond figure specific to this model.
- At 22.7M params, this is the cheapest of the three to run by a wide
  margin and the best fit if the deployment target is CPU-only or
  resource-constrained (e.g. running alongside an LLM on modest hardware).

### Licensing

**Apache License 2.0**, confirmed on two independent primary sources:
1. HF model card frontmatter: `license: apache-2.0`
   ([huggingface.co/sentence-transformers/all-MiniLM-L6-v2/raw/main/README.md](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/raw/main/README.md)).
2. `ollama show all-minilm --license`, against the locally pulled
   artifact — full Apache-2.0 text, matching HF.

No discrepancy.

### Quality benchmarks (STS / retrieval)

Unlike `nomic-embed-text` and `mxbai-embed-large`, this model's own HF card
does **not** embed an official MTEB `model-index` results table — no
first-party MTEB numbers are published directly on the card itself (the
card documents training data/procedure but not benchmark scores). The
closest available number sourced from the MTEB leaderboard is a
reproduction in a third-party HF model card
([minishlab/potion-base-32M](https://huggingface.co/minishlab/potion-base-32M),
which explicitly cites and links the [MTEB leaderboard](https://huggingface.co/spaces/mteb/leaderboard)
as its source and is used here only as a numeric snapshot of that
leaderboard, not as an independent claim):

| Model | Avg (MTEB) | Classification | STS | Retrieval |
|---|---|---|---|---|
| all-MiniLM-L6-v2 | 55.93 | 69.25 | 78.95 | 42.92 |

This flags the honest trade-off directly relevant to this ticket: at
384 dims and 22.7M params, `all-minilm`'s STS score (78.95) trails both
`mxbai-embed-large` (85.00) and `nomic-embed-text-v1` (82.06, per the mxbai
comparison table in §2) by a noticeable margin — the speed/size advantage
comes with a real quality cost on exactly the subtask (STS) most relevant
to this project's memory-recall use case. **Caveat**: the live MTEB
leaderboard ([huggingface.co/spaces/mteb/leaderboard](https://huggingface.co/spaces/mteb/leaderboard))
is a JS-rendered Gradio app that could not be scraped directly for this
research (confirmed by attempting to fetch it — it returns only a loading
shell, no data); the number above is a reproduction of that leaderboard's
data by a third party, not fetched from the leaderboard UI itself. It is
consistent with independent claims elsewhere that this model is a good
speed/quality compromise rather than a top-quality choice.

---

## 4. Cross-reference against ticket 02's Turso/libSQL vector column findings

Ticket 02's research (now resolved, see
[research/02-turso-vector-search.md](02-turso-vector-search.md)) establishes
that libSQL stores vectors in a declared `F32_BLOB(D)` column (4 bytes × D
per vector), with a documented **maximum dimensionality of 65,536**
([docs.turso.tech/features/ai-and-embeddings](https://docs.turso.tech/features/ai-and-embeddings),
as cited in ticket 02's findings).

All three candidates here fit **trivially and comfortably** within that
ceiling:

| Model | Dimension | `F32_BLOB` bytes/vector | % of libSQL's 65,536-dim ceiling |
|---|---|---|---|
| `all-minilm` | 384 | 1,536 B (1.5KB) | 0.6% |
| `nomic-embed-text` | 768 | 3,072 B (3KB) | 1.2% |
| `mxbai-embed-large` | 1024 | 4,096 B (4KB) | 1.6% |

There is no practical dimension-fit concern for any of the three — all sit
under 2% of libSQL's documented maximum, and the resulting `F32_BLOB` size
per row (1.5-4KB) is small relative to typical row/text-content sizes, so
storage isn't a meaningful differentiator between the three models either.

The one place dimension *does* matter, per ticket 02's own findings, is the
**DiskANN ANN index** (`libsql_vector_idx`), which ticket 02 recommends
*not* using at this project's scale (thousands-to-low-tens-of-thousands of
rows per character) due to a documented 10-50× on-disk size multiplier —
independent of which embedding model is chosen. If that recommendation is
ever revisited and the index is adopted, a smaller dimension (e.g.
`all-minilm`'s 384, or `nomic-embed-text`'s MRL-truncated 256/128) would
shrink the index's disk-overhead multiplier further, since DiskANN's
default neighbor count scales with `3·√D` (per ticket 02 §4) — but this is
a secondary consideration, not a blocker, for any of the three models at
this project's stated scale. The **plain, unindexed `ORDER BY
vector_distance_cos(...) LIMIT k` scan ticket 02 recommends works
identically regardless of which of these three dimensions is chosen** —
dimension is not a factor in that recommendation.

**Bottom line**: no dimension-related tradeoff should drive the model
choice here — all three fit comfortably in libSQL's `F32_BLOB` column type
with room to spare, at both the dimension-limit and the row-storage-size
level.

---

## Recommendation

**`nomic-embed-text` (v1.5) is the recommended default** for this project's
memory-recall feature:

- It's Apache-2.0 licensed (confirmed both on Hugging Face and in the
  actual Ollama-distributed artifact's bundled license text — no
  discrepancy), small (137M params, 274MB), and fast enough on both the
  empirical GPU measurement here (~20-40ms/short message) and by
  parameter-count reasoning for CPU-only deployment.
- Its 768-dim output fits libSQL's `F32_BLOB` column with enormous headroom
  (§4), and its built-in Matryoshka support (768→512→256→128→64, with a
  documented, gentle quality curve — 62.28→56.10 MTEB avg across that whole
  range) is a genuinely useful escape hatch if row/index storage ever
  becomes a real constraint later, without needing to swap models.
- By far the most production-battle-tested option in Ollama's library for
  this task (78.9M pulls vs. 12.7M for `mxbai-embed-large` and 3.3M for
  `all-minilm`), which matters for a self-hosted project that won't have a
  vendor SLA to fall back on.

**`mxbai-embed-large` is the recommended upgrade path** if retrieval
quality on the memory-recall feature turns out to matter more than raw
speed/footprint once the feature is live: it posts the best STS score of
the three surveyed here (85.00 vs. nomic-embed-text-v1's 82.06), is still
Apache-2.0 and small enough (335M, 670MB) to self-host comfortably, and its
1024-dim output is still trivially small for libSQL's `F32_BLOB` column
(§4). The empirical latency gap vs. `nomic-embed-text` measured here was
small (tens of milliseconds) at this model scale, so this isn't a
heavyweight trade — it's a reasonable A/B candidate.

**`all-minilm` is the fallback for constrained hardware only** — it's the
cheapest and fastest by a wide margin (22.7M params, fastest in every
empirical timing run here) and still Apache-2.0, but its STS score (78.95)
trails both other candidates by a real margin, which directly affects
memory-recall quality (the exact subtask this feature depends on). Reach
for it only if the target deployment genuinely can't spare the extra
tens-of-milliseconds and ~250-600MB of the other two options — not as a
default.

**Practical note for implementation**: whichever model is chosen, `ollama
show <model> --license` and `ollama show <model> -v` (run against the
locally pulled artifact, as done throughout this research) are more
reliable primary sources for dimension/license/context-window than
Ollama's own web library pages, which — as of this research — do not
surface a license tab or a dimension figure on the model's public page at
all; that information currently only lives in the model's Modelfile/GGUF
metadata (retrievable via the CLI once pulled) or on the upstream Hugging
Face repo.

---

## References

- [ollama.com/search?c=embedding](https://ollama.com/search?c=embedding) —
  full current list of Ollama-tagged embedding models, pull counts.
  Accessed 2026-07-19.
- [ollama.com/library/nomic-embed-text](https://ollama.com/library/nomic-embed-text) —
  Ollama library page (description, tags/context-window/size). Accessed
  2026-07-19. No license or dimension info present on the page itself.
- [ollama.com/library/mxbai-embed-large](https://ollama.com/library/mxbai-embed-large) —
  same, for mxbai-embed-large. Accessed 2026-07-19.
- [ollama.com/library/all-minilm](https://ollama.com/library/all-minilm) —
  same, for all-minilm. Accessed 2026-07-19.
- `ollama show <model> -v` and `ollama show <model> --license` — run
  directly against `nomic-embed-text`, `mxbai-embed-large`, and
  `all-minilm` after pulling each with Ollama 0.20.4 on this research
  machine. Primary source for exact embedding dimension, context length,
  parameter count, quantization, and the actual bundled license text of
  the Ollama-distributed artifact (as opposed to the upstream HF repo,
  which could in principle differ but did not for any of the three models
  checked here).
- [huggingface.co/nomic-ai/nomic-embed-text-v1.5](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5)
  and its `raw/main/config.json` and `raw/main/README.md` — primary source
  for dimension, license frontmatter, MRL benchmark table, context-scaling
  recipe.
- Nussbaum, Z., Morris, J.X., Duderstadt, B., Mulyar, A. "Nomic Embed:
  Training a Reproducible Long Context Text Embedder." arXiv:2402.01613.
  https://arxiv.org/abs/2402.01613
- [huggingface.co/mixedbread-ai/mxbai-embed-large-v1](https://huggingface.co/mixedbread-ai/mxbai-embed-large-v1),
  `raw/main/config.json`, `raw/main/1_Pooling/config.json`,
  `raw/main/README.md` — primary source for dimension, license, and the
  full 56-dataset MTEB comparison table.
- [mixedbread.com/blog/mxbai-embed-large-v1](https://www.mixedbread.com/blog/mxbai-embed-large-v1) —
  MixedBread's own announcement post; checked for first-party latency
  numbers (none found).
- [huggingface.co/sentence-transformers/all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)
  and `raw/main/README.md` — primary source for dimension, license,
  training procedure. No first-party MTEB table on this card.
- [sbert.net/docs/sentence_transformer/pretrained_models.html](https://sbert.net/docs/sentence_transformer/pretrained_models.html) —
  sentence-transformers project's own pretrained-model docs; source for
  the "5x faster than all-mpnet-base-v2" first-party relative-speed claim.
- [huggingface.co/minishlab/potion-base-32M](https://huggingface.co/minishlab/potion-base-32M) —
  third-party HF card reproducing MTEB-leaderboard numbers for
  all-MiniLM-L6-v2 (55.93 avg, 78.95 STS, 42.92 retrieval); used because
  the live MTEB leaderboard could not be scraped directly (see below).
- [huggingface.co/spaces/mteb/leaderboard](https://huggingface.co/spaces/mteb/leaderboard) —
  attempted directly; returns only a JS-rendered loading shell via
  automated fetch, no queryable data without a browser session. Numbers
  attributed to "MTEB" in this document come from model cards that embed
  official `model-index` results (nomic-embed-text-v1.5,
  mxbai-embed-large-v1) or from a third-party reproduction
  (all-MiniLM-L6-v2, via minishlab, above) where no first-party
  `model-index` was found on the model's own card.
- [huggingface.co/nomic-ai/nomic-embed-text-v1.5/discussions/34](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5/discussions/34) —
  community discussion flagging slow CPU-only inference; no exact numbers,
  used only to flag the GPU-vs-CPU caveat.
- This research's own empirical latency measurements: `curl` timing against
  a local `ollama serve` (v0.20.4) instance, Intel i5-6600K + NVIDIA RTX
  3060 12GB, all three models pulled and warm-loaded, ~20-word chat-length
  test string, 3-5 repeated timed requests per model. Illustrative of one
  machine's GPU-accelerated performance, not a general/universal figure —
  labeled as such throughout this document.
- [research/02-turso-vector-search.md](02-turso-vector-search.md) — this
  project's own prior research (ticket 02), used for the `F32_BLOB(D)`
  column type, its 65,536-dimension ceiling, and the DiskANN
  index/no-index recommendation cross-referenced in §4.

## Not pursued further

- **`qwen3-embedding`, `embeddinggemma`, `bge-m3`, `snowflake-arctic-embed`,
  `snowflake-arctic-embed2`, `granite-embedding`, `bge-large`,
  `paraphrase-multilingual`, `nomic-embed-text-v2-moe`** — all confirmed
  present in Ollama's library (§0) but not deep-dived, since the ticket
  asked for the top 2-3 candidates and the three selected already cover
  the size/quality/battle-testing spectrum relevant to this project's
  short-conversational-text use case. Worth a follow-up look if a future
  ticket specifically wants multilingual support (`bge-m3`,
  `paraphrase-multilingual`, `snowflake-arctic-embed2`) or wants to
  benchmark the newest Google/Qwen/IBM entries head-to-head against the
  three surveyed here.
- **CPU-only empirical latency benchmark** — attempted (spinning up a
  second local `ollama serve` instance with `CUDA_VISIBLE_DEVICES=""`) but
  blocked by a model-storage-path mismatch between the system service
  (models under `/usr/share/ollama/.ollama`, owned by the `ollama` user)
  and a user-level second instance; not worth re-pulling multiple hundred
  MB of models a second time under a different path just for this
  research. Flagged in-line above as a gap — genuinely worth doing on the
  project's actual target deployment hardware before finalizing a choice,
  especially if that hardware has no GPU.
