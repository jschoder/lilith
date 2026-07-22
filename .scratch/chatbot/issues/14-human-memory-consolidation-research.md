# Human memory consolidation and emotional-salience models

Type: research
Status: resolved

## Question

[Ticket 05](05-memory-compression-pipeline.md)'s remaining open decision is
the storage granularity of long-term memory (one record per source message
vs. one per compressed batch) and how a memory's associated emotional state
(per [ticket 04](04-emotion-model-design.md)'s Emotion/Mood vectors) should
be linked to it for later emotionally-triggered recall. Rather than picking
a granularity for engineering-convenience reasons alone, research how human
memory consolidation actually works and how emotion attaches to memories,
to see whether a specific structure is a closer analog:

- What does cognitive-science/neuroscience literature say about the grain
  of a "memory unit" during consolidation — is a single retained memory
  closer to a discrete event, or a compressed gist covering a cluster of
  related events (episodic vs. semantic memory, consolidation theory)?
- How does emotional intensity at encoding time affect what's retained vs.
  discarded during consolidation (e.g., the amygdala's role in flagging
  high-arousal experiences for stronger/longer retention)?
- Is there a well-established computational/cognitive-architecture analog
  already used in memory-augmented LLM agent systems (e.g. generative
  agents' memory-stream + reflection approach, MemGPT/similar) that models
  this, rather than reinventing from raw neuroscience?
- Concretely: should an emotional-intensity value be stored as metadata on
  a memory record to bias retrieval/decay, and at what grain (per source
  message, per gist/batch)?

This feeds back into [ticket 05](05-memory-compression-pipeline.md)
(long-term storage granularity — per-message vs. per-batch embedding rows)
and [ticket 06](06-memory-retrieval-scoring.md) (emotional-salience biasing
retrieval, already assumed by ticket 04's answer that "ticket 06 reads
emotional salience directly as the peak Emotion-vector component(s) at the
time of the memory"). Capture sources.

## Answer

Full findings: [../research/14-human-memory-consolidation.md](../research/14-human-memory-consolidation.md).

**Grain**: not one or the other — human consolidation is two sequential
stores. Complementary Learning Systems theory (McClelland, McNaughton &
O'Reilly 1995; updated for AI agents in Kumaran, Hassabis & McClelland
2016, *Trends in Cognitive Sciences*) has the hippocampus doing fast,
one-shot **event-level** encoding (Tulving's episodic memory), while the
neocortex slowly extracts **gist/semantic** structure from many episodes
via offline replay — critically, gist-extraction is additive and later:
generalized representations get built *from* the episodic store without
deleting or merging the source episodes.

**Emotional salience**: well-established, not folklore. McGaugh (2004,
*Annual Review of Neuroscience*) is the canonical source — amygdala
activation at encoding (via stress hormones) modulates *consolidation
strength* in other regions, is time-dependent (acts during the
post-event consolidation window, not just at the moment of encoding), and
"the degree of activation of the amygdala by emotional arousal during
encoding... correlates highly with subsequent recall." It's selective, not
uniform: the emotion-induced memory trade-off literature (Easterbrook 1959
attention-narrowing; corroborated in PMC2798819) shows emotionally salient
content is retained at the expense of surrounding peripheral detail, not
"everything nearby is remembered better." Kumaran et al. (2016) generalize
this into a "reweighting" principle: surprising/high-reward/emotionally
charged episodes get preferential storage *and* preferential replay,
compounding into stronger long-term consolidation — and they cite
Prioritized Experience Replay (Schaul et al. 2016, DeepMind) as the RL
field's independent convergence on the same idea.

**Existing LLM-agent analog — a close, direct match already exists.**
Generative Agents (Park et al. 2023, arXiv:2304.03442) is the paper: memory
stream stores one **observation per event** (episodic grain, matching the
neuroscience), each object gets an LLM-scored **importance/"poignancy" 1-10
field at creation time** (their own examples — "a break up," "college
acceptance" — are inherently emotional, functioning as an emotional-salience
proxy), and retrieval score is `α_recency·recency + α_importance·importance
+ α_relevance·relevance` (all α=1, min-max normalized). Their "reflection"
mechanism (triggered when cumulative importance crosses a threshold, 150)
produces higher-level summaries stored as *new* memory objects carrying
explicit citation pointers back to the source observations — never deleting
or merging them. MemGPT (Packer et al. 2023, arXiv:2310.08560) is a useful
contrast: verbatim per-message storage, purely token-budget-triggered
eviction, **no** importance/salience weighting at all — proof a mainstream
agent-memory architecture can ship without this, but not the paper that
answers this ticket's question the way Generative Agents does.

**Recommendation for tickets 05/06**:
1. Long-term memory rows should be **per-source-message** (event grain), not
   per-batch — matches every source surveyed. "Compression" per ticket 05
   should mean a short gist replacing raw text *per message*, not merging
   several messages into one row.
2. A separate, additive **reflection/consolidated-summary layer** (own
   table, or a `type` discriminator) should sit on top, storing which
   per-message rows it was derived from — mirrors Generative Agents'
   citation-pointer tree and the neuroscience's "gist is derived from,
   not a replacement for, episodic traces." Doesn't need to ship
   immediately, but the schema shouldn't foreclose it.
3. Consider cumulative/peak emotional intensity as an *additional*
   promotion trigger for ticket 05 (alongside whatever turn-count/token
   trigger is chosen) — Generative Agents triggers reflection generation
   off cumulative importance, not just volume, so one highly emotional
   exchange could warrant earlier consolidation.
4. **Yes**, store peak Emotion-vector intensity (ticket 04's `max()` over
   the 8 Plutchik dimensions at message time) as a queryable field per
   memory row, and reuse Generative Agents' formula shape for ticket 06:
   `score = w_recency·recency_decay + w_emotion·peak_emotion_intensity +
   w_relevance·cosine_similarity`, normalized, equal weights as a starting
   point. Cheaper than their approach here — no extra LLM call needed,
   since the peak-emotion value is already a byproduct of ticket 04's
   existing appraisal step.

Left open for tickets 05/06 to actually decide: exact schema split, exact
promotion-trigger thresholds, and exact retrieval-score weights — this
research narrows the *shape* of those decisions, not the literal numbers
(Generative Agents' constants were tuned for a simulated town, not this
project's turn-based chat medium, the same caveat ticket 04 already applied
to ALMA's constants).
