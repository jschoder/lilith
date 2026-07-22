# 21 — Long-term memory: retrieval scoring

**What to build:** Compressed messages become actually useful — generation prompts now include older, relevant-or-emotionally-charged messages surfaced by a single blended-score query, so a user's question about something from weeks ago (or an emotionally vivid past moment) gets answered correctly instead of the Character acting like it never happened.

**Blocked by:** 20

**Status:** ready-for-agent

- [ ] The weighted-sum retrieval query (similarity + recency half-life + `peak_emotion_intensity`) runs directly against a real libSQL file seeded with known embedded rows, with no tRPC/LLM involved, and returns candidates in the expected blended-score order.
- [ ] Candidates are greedily added to the prompt in descending score order until either the flat `retrieval_token_budget` is exhausted or a candidate falls below `min_retrieval_score`.
- [ ] `memory_summaries` rows are never included in retrieval (no embedding column to score).
- [ ] An integration test demonstrates a Compressed message that's topically weak but has high `peak_emotion_intensity` outranking a topically closer but flat one, and both the Short-term tail and retrieved Long-term results reach the actual generation prompt.
- [ ] A conversation resumed after a long gap does not replay the full stale short-term window verbatim — retrieval, not full replay, carries old context back in.
- [ ] All weights/budget/cutoff constants live in `tuning.ts`.
