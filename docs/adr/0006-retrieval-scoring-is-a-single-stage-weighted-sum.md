# Retrieval scoring is a single-stage weighted sum, not filter-then-rank

Candidates for combining Long-term Memory retrieval's three signals
(vector similarity, recency, Peak Emotion Intensity) were a two-stage
pipeline — pre-filter candidates by a minimum similarity floor, then
re-rank survivors by a blended score — or a single-stage weighted sum
ranking every Compressed Message at once. We picked the single-stage sum.

Ticket 02 already established that retrieval runs as an unindexed
`ORDER BY vector_distance_cos(...) LIMIT k` scan over the full `messages`
table at this project's per-character-file scale — every row's similarity
is computed regardless. A pre-filter stage buys nothing there; it would
only add a second tunable (candidate-pool size) with no scale problem to
justify it.

More importantly, a hard similarity floor was rejected on domain grounds,
not just performance: it would prevent a highly recent or emotionally
intense memory from ever surfacing when its topical similarity to the
current turn is weak. Letting the blended score allow that is a deliberate
choice — a vivid emotional memory intruding on a loosely related
conversation is realistic, not noise to filter out.

Formula: `score = w_sim*similarity + w_rec*recency_factor + w_sal*peak_emotion_intensity`,
all three terms normalized to `[0,1]`, weights summing to 1. `similarity`
corrects `vector_distance_cos`'s `[0,2]` distance range; `recency_factor`
reuses ADR-0001/ADR-0005's exponential half-life decay shape, off
`created_at`. A `min_retrieval_score` cutoff (applied to the *blended*
score, not raw similarity) still guards against a generous token budget
padding in low-relevance memories once genuinely strong candidates run
out. See [ticket 06](../../.scratch/chatbot/issues/06-memory-retrieval-scoring.md).
