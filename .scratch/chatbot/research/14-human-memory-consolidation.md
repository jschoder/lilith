# Human memory consolidation and emotional-salience models: survey

Findings for [issue 14](../issues/14-human-memory-consolidation-research.md). Feeds
[ticket 05](../issues/05-memory-compression-pipeline.md) (long-term storage
granularity — per-message vs. per-batch) and
[ticket 06](../issues/06-memory-retrieval-scoring.md) (emotional-salience
biasing retrieval, per [ticket 04](../issues/04-emotion-model-design.md)'s
Emotion/Mood vectors).

## Question recap

1. What grain does human memory consolidation actually operate at — is a
   retained memory closer to a discrete event, or a compressed gist
   spanning a cluster of events?
2. How does emotional/arousal intensity at encoding affect what's retained
   vs. discarded?
3. Is there an established computational analog in memory-augmented LLM
   agent architectures (Generative Agents, MemGPT, or similar), rather than
   reinventing this from raw neuroscience?
4. Concretely: should long-term memory rows be per-source-message or
   per-batch, and should emotional intensity be stored as queryable
   metadata to bias retrieval?

---

## 1. What grain does consolidation operate at? (episodic vs. semantic)

**The short answer is "both, in sequence, as two distinct stores" — not a
single grain.** This is the core claim of Complementary Learning Systems
(CLS) theory, the dominant account in cognitive neuroscience since the
mid-1990s:

- **Tulving (1972)** first formalized the episodic/semantic split:
  *episodic memory* holds specific, time-and-place-bound personal
  experiences; *semantic memory* holds general facts/concepts abstracted
  away from any single experience
  ([Tulving, "Episodic and Semantic Memory," in *Organization of Memory*,
  1972](https://www.scirp.org/reference/referencespapers?referenceid=2919588)).
  Tulving's own later work treated the two as interdependent rather than
  fully separate systems, but the basic unit distinction — one memory
  record per lived event vs. a decontextualized general fact — has held up
  as the field's working vocabulary since.

- **McClelland, McNaughton & O'Reilly (1995)**, "Why there are
  complementary learning systems in the hippocampus and neocortex,"
  *Psychological Review* 102(3):419-457, gave this a mechanistic account:
  the hippocampus does fast, sparse, pattern-separated **one-shot encoding
  of individual episodes** (this is what makes episodic memory possible at
  all — you only need one exposure to remember what happened at breakfast
  today), while the neocortex learns slowly, via many *interleaved*
  exposures across episodes, extracting **shared statistical structure**
  (semantic knowledge / "gist") from the accumulated set. The two systems
  exist specifically because a single network can't do both well: fast
  one-shot learning of specifics causes catastrophic interference with
  slowly-learned general structure, and vice versa.

- **Kumaran, Hassabis & McClelland (2016)**, "What Learning Systems do
  Intelligent Agents Need? Complementary Learning Systems Theory Updated,"
  *Trends in Cognitive Sciences* 20(7):512-534 ([open PDF, Stanford](http://stanford.edu/~jlmcc/papers/KumaranHassabisMcClelland16FinalMS.pdf),
  fetched and text-extracted for this research) — the most useful single
  source found, because it is explicitly written to bridge CLS theory to
  **artificial agent memory-system design** (co-authored by two DeepMind
  researchers). Confirms the grain question directly: the hippocampal
  store's basic unit is **the individual episode** ("tapping 'episodic
  memory' (memory for the elements of one specific experience)," p.6 of the
  extracted text), and generalized/semantic representations are a
  *downstream, later-emerging* product of "generalized replay —
  simultaneous reactivation of multiple related traces during testing or
  offline periods" that "may facilitate the creation of new representations
  from the recombination of multiple related episodes ('stored
  generalizations')" (p.10). Critically: **the episodic traces are not
  deleted or merged when this happens** — the paper explicitly frames
  generalization as new representations *derived from*, and coexisting
  with, the underlying episode-level store, not a replacement for it.

- **Diekelmann & Born (2010)**, "The Memory Function of Sleep," *Nature
  Reviews Neuroscience* 11:114-126 ([nature.com/articles/nrn2762](https://www.nature.com/articles/nrn2762))
  — the standard reference for **active systems consolidation**: during
  slow-wave sleep, hippocampus-dependent memory traces are repeatedly
  reactivated ("replayed") and progressively redistributed to neocortical
  sites, a gradual process that operates on already-encoded episodic traces
  over subsequent hours/days/nights, not something that happens once at the
  moment of the original event.

**Conclusion for (1):** the base unit that gets *encoded* is the individual
event/episode, always. "Gist" is real, but it is a second, later-forming,
additively-derived representation built by aggregating across many
already-stored episodic units — it is not what the initial storage step
produces, and it does not overwrite the episodic units it was built from.
Any system modeling this should keep event-level records as the ground
truth and treat gist/summary as an additional derived layer, not a
replacement for the per-event layer.

---

## 2. How does emotional/arousal intensity at encoding affect retention?

Three converging, well-established findings:

### 2a. Amygdala-mediated modulation of consolidation strength

**McGaugh (2004)**, "The Amygdala Modulates the Consolidation of Memories
of Emotionally Arousing Experiences," *Annual Review of Neuroscience*
27:1-28 ([PubMed abstract, PMID 15217324](https://pubmed.ncbi.nlm.nih.gov/15217324/)) —
the canonical review on this mechanism (2,000+ citations). Direct quotes
from the abstract:

> "Converging findings of animal and human studies provide compelling
> evidence that the amygdala is critically involved in enabling us to
> acquire and retain lasting memories of emotional experiences."

> "the degree of activation of the amygdala by emotional arousal during
> encoding of emotionally arousing material (either pleasant or unpleasant)
> correlates highly with subsequent recall."

Mechanistically: emotional arousal triggers adrenal stress hormones
(epinephrine, glucocorticoids) and noradrenergic activity that act on the
**basolateral amygdala (BLA)**, which in turn modulates consolidation in
other memory-relevant regions (hippocampus, caudate nucleus, nucleus
accumbens, cortex) — critically, this is a **post-encoding, time-dependent
consolidation effect**, not purely an attention-at-encoding effect: McGaugh's
broader body of work (summarized in this review) is built on findings that
manipulating stress hormones *after* an experience still changes how well
it's later remembered, meaning the amygdala biases which already-encoded
traces get consolidated into durable long-term storage, not just which
experiences get noticed as they happen.

**LaBar & Cabeza (2006)**, "Cognitive Neuroscience of Emotional Memory,"
*Nature Reviews Neuroscience* 7:54-64 ([PubMed, PMID 16371950](https://pubmed.ncbi.nlm.nih.gov/16371950/);
full text at [dibs-web01.vm.duke.edu/labar/pdfs/LaBar_Cabeza_2006.pdf](https://dibs-web01.vm.duke.edu/labar/pdfs/LaBar_Cabeza_2006.pdf))
is the standard companion review, covering the same "modulation hypothesis"
from encoding through consolidation to retrieval, and is the more commonly
cited source for the claim that emotionally arousing experiences are
retained *longer and more resistant to forgetting* than matched neutral
experiences — the general textbook-level consensus this ticket asked to
confirm.

### 2b. It's a selective trade-off, not uniform enhancement

Emotion doesn't uniformly boost retention of everything in the encoding
window — it **redistributes** what's retained, sharpening memory for the
emotionally salient/central content at the cost of surrounding/peripheral
detail. This is the well-replicated **emotion-induced memory trade-off**,
rooted in Easterbrook's 1959 attention-narrowing hypothesis. From a
representative PMC review fetched for this research
([PMC2798819, "Impact of individual differences upon emotion-induced memory
trade-offs"](https://pmc.ncbi.nlm.nih.gov/articles/PMC2798819/)):

> "memory for the emotional component (e.g., the snake) is good, but memory
> for the nonemotional elements (e.g., the forest) is poor."

> "emotionally arousing critical details are remembered at the expense of
> their contextual elements (Easterbrook, 1959)."

### 2c. This is framed as a general "reweighting" principle in CLS theory, not just an amygdala-specific quirk

Kumaran, Hassabis & McClelland (2016) (§1 above) generalize the amygdala
finding into a broader hippocampal "reweighting" mechanism, and this is the
single most directly useful passage found for this ticket (extracted
verbatim from the paper's PDF, p.8-9):

> "mounting evidence suggests that replay may be biased towards rewarding
> events... we consider the broader hypothesis that the hippocampus may
> allow the general statistics of the environment to be circumvented by the
> reweighting of experiences, so that statistically unusual but significant
> events may be afforded privileged status, leading not only to preferential
> storage and/or stabilization... but also leading to preferential replay
> that then shapes neocortical learning."

> "A wide range of factors may affect the significance of individual
> experiences: for example, they may be surprising or novel; high in reward
> value (either positive or negative)... providing mechanisms by which
> episodes may be retrospectively reweighted if their significance is
> enhanced by subsequent events... thereby influencing the probability of
> replay."

> [worked example] "Imagine that one day the child experiences an encounter
> with a frightening, aggressive dog — an event that would be surprising,
> novel, and charged with emotion... here we highlight an additional role
> for the hippocampus in 'marking' salient but statistically infrequent
> experiences, thereby ensuring that such events are not swamped by the
> wealth of typical experiences — but rather are preferentially stabilized
> and replayed to the neocortex."

**Conclusion for (2):** emotional/arousal intensity at encoding time (a)
is a real, mechanistically-grounded (amygdala/stress-hormone) signal that
(b) biases *which* memories get consolidated more strongly and replayed
more often, converting into longer-lasting, more retrievable storage, but
(c) does so selectively (central/salient content over peripheral context),
and (d) the effect is not confined to the moment of encoding — it continues
to influence a memory's fate throughout the consolidation window that
follows the event.

---

## 3. Existing computational analogs in LLM-agent memory architectures

### 3a. Generative Agents (Park et al., 2023) — the direct analog

["Generative Agents: Interactive Simulacra of Human Behavior,"
arXiv:2304.03442](https://arxiv.org/abs/2304.03442) (Park, O'Brien,
Cai, Morris, Liang, Bernstein — Stanford/Google, UIST 2023). Read via the
ar5iv full-text rendering for this research. This paper is the closest
existing analog to exactly what ticket 14 asks about, and it independently
converges on almost the same design this project is considering:

**Memory grain — per-event, not per-batch.** The paper's memory stream
stores one **observation** per perceived event:

> "The most basic element of the memory stream is an observation, which is
> an event directly perceived by an agent."

Each memory object holds a natural-language description, a creation
timestamp, and a most-recent-access timestamp (plus, implicitly, an
embedding for relevance scoring). This is event-level, matching the
neuroscience's episodic grain — not a batch/session-level record.

**Importance as a first-class, queryable field set at creation time** —
this is the direct analog to "should emotional intensity be stored as
metadata":

> "On the scale of 1 to 10, where 1 is purely mundane (e.g., brushing
> teeth, making bed) and 10 is extremely poignant (e.g., a break up,
> college acceptance), rate the likely poignancy of the following piece of
> memory."

The score is generated by directly prompting the LLM, at the moment the
memory object is created, and stored as an integer 1-10 field on that
memory object. Note the examples chosen ("a break up," "college
acceptance") are inherently *emotional* events — "importance"/"poignancy"
in this paper functions as an emotional-salience proxy, which is precisely
the role ticket 04's peak-Emotion-vector value is proposed to play here.

**Retrieval scoring formula** — importance is one of three additive,
equally-weighted, min-max-normalized terms:

> "score = α_recency · recency + α_importance · importance + α_relevance ·
> relevance" — with "all α's... set to 1."

- *recency*: exponential decay over elapsed time since last retrieval
  (decay factor 0.995 per simulated hour)
- *importance*: the stored 1-10 score, as-is
- *relevance*: cosine similarity between the memory's embedding and the
  current query's embedding

This is a directly reusable formula shape for ticket 06.

**Reflection (consolidation) mechanism — additive, not destructive.**
Reflections are periodically generated:

> "we generate reflections when the sum of the importance scores for the
> latest events perceived by the agents exceeds a threshold (150 in our
> implementation)."

A reflection is a higher-level synthesized statement, itself stored back
into the same memory stream and given its own recency/importance/relevance
scores (so it can itself be retrieved), but — critically — it does **not**
replace or delete the observations it was built from. It's stored with
explicit **pointers/citations back to the source memory objects**:

> "Agents generate trees of reflections: the leaf nodes of the tree
> represent the base observations, and the non-leaf nodes represent
> thoughts that become more abstract... including pointers to the memory
> objects that were cited," e.g. "Klaus Mueller is dedicated to his
> research on gentrification (because of 1, 2, 8, 15)."

This is structurally identical to the neuroscience picture in §1: base
episodic records persist as ground truth; a higher-level gist/reflection
is an *additional*, derived, separately-retrievable object that references
its sources rather than consuming them.

### 3b. MemGPT (Packer et al., 2023) — a contrasting analog, useful as a counter-example

["MemGPT: Towards LLMs as Operating Systems," arXiv:2310.08560](https://arxiv.org/abs/2310.08560)
(Packer et al., UC Berkeley). Read via the ar5iv full-text rendering.

MemGPT's memory hierarchy: an in-context working set (System Prompt, Core
Memory, a running Chat Summary, recent Chat History) backed by two
out-of-context tiers — **Recall Memory** (a searchable log of past
conversation) and **Archival Memory** (a general-purpose read/write store
for arbitrary long text).

Two points of contrast with Generative Agents, both relevant to this
ticket:

- **Storage grain is per-message and verbatim**, not compressed: the
  system "writes both the incoming message and the generated LLM output to
  recall storage" after each turn — no summarization/compression step is
  applied before storage. Eviction from the in-context working set is
  triggered purely by **token-budget pressure** (a documented ~70%
  "memory pressure" warning threshold, forced flush at 100%), producing a
  **recursive summary of evicted messages** stored as a system message —
  this is MemGPT's closest thing to a "gist," but note it exists to manage
  the *context window*, not as a long-term-storage compression step; the
  underlying messages remain separately queryable in Recall Memory
  regardless.
- **No importance/emotional-salience weighting mechanism at all.**
  Retrieval from Recall/Archival memory in MemGPT is driven by explicit
  LLM-issued function calls (e.g. `conversation_search`) using
  recency/pagination and text/relevance search — nothing in the paper
  assigns or uses a salience/importance score to bias what's kept or
  surfaced.

**Why this contrast matters for ticket 14**: MemGPT demonstrates that a
credible, widely-adopted LLM-agent memory architecture can ship *without*
emotional/importance weighting — it isn't a load-bearing requirement for a
working system. But it also means MemGPT is not the paper that answers
this ticket's actual question; Generative Agents is the one that
specifically added, and empirically relied on, an importance/salience field
to produce more believable long-horizon agent behavior — the exact
capability ticket 04/06 are trying to add here.

### 3c. Prioritized Experience Replay — the same idea, independently arrived at in RL

Referenced directly inside Kumaran, Hassabis & McClelland (2016) as the
artificial-agent analog to hippocampal "reweighting" (§2c): Schaul et al.,
["Prioritized Experience Replay," ICLR 2016](https://arxiv.org/abs/1511.05952)
(cited as ref. [181] in the CLS-updated paper). The CLS paper's own
description (Box 9, extracted from the PDF):

> "Instead of employing a standard online learning method in which each
> unit of play experience... is used immediately to adjust connection
> weights and then discarded, an experience replay buffer similar to the
> hippocampus is used... in accord with the hypothesis that
> hippocampus-dependent RL facilitates learning during off-line periods."

Prioritized Experience Replay specifically weights which stored
transitions get replayed by TD-error magnitude (a proxy for
"how surprising/informative was this experience"), rather than sampling
uniformly — this is the machine-learning field's independent
re-derivation of exactly the same "not all stored experiences deserve
equal future attention" principle McGaugh's amygdala work and Generative
Agents' importance field both encode, arrived at from a completely
different (RL optimization) motivation. Its presence, cited by name inside
a neuroscience→AI bridge paper, is corroborating evidence that
salience-weighted retention/retrieval is a convergent, not
neuroscience-only or LLM-agent-only, design pattern.

---

## 4. Recommendation

**(a) Long-term memory rows should be per-source-message (event-level), not
per-compressed-batch.** This is the consistent answer across every source
surveyed: CLS theory's hippocampal store, Diekelmann & Born's sleep
consolidation, and Generative Agents' memory stream all treat the
individual event/message as the base storage unit, with any
gist/summary/reflection layer built *on top of*, not *instead of*, that
base layer. Concretely for ticket 05:

- Each retained source message (or a tight, single-topic cluster of
  adjacent turns) gets its own long-term row: embedding + a short
  LLM-written gist of that message/exchange + metadata (see below). This
  is the "compression" ticket 05 already wants for long-term storage — a
  gist replacing the full raw text, at message grain, not a summary
  spanning many messages collapsed into one row.
- A **separate, additional row type** (a "reflection"/consolidated-summary
  table, or a `type` discriminator on the same table) holds
  higher-level syntheses spanning many per-message rows, each one storing
  which source rows it was derived from (Generative Agents' citation
  pointers — a simple foreign-key/array-of-ids column would do). This
  layer is optional to build immediately, but the schema should not
  foreclose it, since it's exactly what both the neuroscience and the
  Generative Agents precedent converge on as the second, later-forming
  layer.
- This also gives ticket 05 a natural, precedented answer for *when*
  promotion/consolidation happens: Generative Agents triggers reflection
  generation when cumulative importance crosses a threshold (150, in their
  implementation) rather than purely on a turn-count/token budget — worth
  considering as an additional trigger condition alongside whatever
  turn/token/time trigger ticket 05 settles on, so that a single highly
  emotional exchange can trigger earlier consolidation even before a
  volume-based threshold would otherwise fire.

**(b) Yes — store the peak Emotion-vector intensity at message time as a
queryable field on each long-term memory row**, exactly as ticket 04
already anticipated ("ticket 06 reads emotional salience directly as the
peak Emotion-vector component(s) at the time of the memory"). This is
independently justified by:

- The neuroscience (§2): emotional/arousal intensity at encoding is a real,
  mechanistically-established (amygdala/stress-hormone) determinant of
  what gets consolidated into durable memory and how strongly.
- The closest LLM-agent precedent (§3a): Generative Agents already
  implements exactly this pattern — an LLM/appraisal-scored salience field,
  set once at memory-creation time, used as one of three equally-weighted,
  min-max-normalized linear terms in the retrieval score, alongside
  recency (exponential decay) and relevance (embedding cosine similarity).

**Recommend reusing that formula shape directly for ticket 06**:

```
score = w_recency · recency_decay(elapsed_since_last_retrieval)
      + w_emotion · peak_emotion_intensity
      + w_relevance · cosine_similarity(query_embedding, memory_embedding)
```

with min-max normalization per term and equal weights as a starting point
(Generative Agents' own default), tunable later — this gives ticket 06 an
evidence-backed starting formula instead of inventing one from scratch.
One deviation worth considering: ticket 04's Emotion vector is 8-dimensional
(Plutchik primaries) rather than a single poignancy scalar, so
`peak_emotion_intensity` should likely be `max()` over the 8 dimensions at
message time (the "peak component" ticket 04 already specifies) rather than
an LLM-judged single scalar — cheaper (no extra LLM call, unlike Generative
Agents' dedicated importance-rating prompt) and already produced as a
byproduct of the emotion-appraisal step ticket 04 designed.

**What this implies that ticket 05/06 still need to decide** (left open
for the main session, not resolved here): the exact per-message vs.
reflection-table schema split, the specific promotion trigger condition(s)
and thresholds, and the specific retrieval-score weights — this research
narrows the *shape* of those decisions (event-grain base rows + optional
additive reflection layer; three-term recency/emotion/relevance retrieval
score) without picking exact numbers, which should be tuned against this
project's own data rather than copied verbatim from a simulated-town
multi-agent paper.

---

## References

- Tulving, E. (1972). "Episodic and Semantic Memory." In *Organization of
  Memory*, Tulving & Donaldson (eds.), pp. 381-403. Academic Press.
  ([citation record](https://www.scirp.org/reference/referencespapers?referenceid=2919588)) —
  primary source for the original episodic/semantic memory distinction.
- McClelland, J.L., McNaughton, B.L., O'Reilly, R.C. (1995). "Why there are
  complementary learning systems in the hippocampus and neocortex: insights
  from the successes and failures of connectionist models of learning and
  memory." *Psychological Review*, 102(3), 419-457.
  ([citation record](https://www.semanticscholar.org/paper/Why-there-are-complementary-learning-systems-in-the-McClelland-McNaughton/2ebf18e7892e660a833152ddc6cf8f1d21a7b881)) —
  primary/founding source for Complementary Learning Systems (CLS) theory:
  hippocampal fast one-shot episodic encoding vs. neocortical slow
  interleaved semantic/gist extraction.
- Kumaran, D., Hassabis, D., McClelland, J.L. (2016). "What Learning
  Systems do Intelligent Agents Need? Complementary Learning Systems Theory
  Updated." *Trends in Cognitive Sciences*, 20(7), 512-534.
  [Open-access PDF (Stanford)](http://stanford.edu/~jlmcc/papers/KumaranHassabisMcClelland16FinalMS.pdf) —
  fetched and text-extracted directly for this research (via `pdftotext`).
  Primary source for: the "reweighting" account of salience-biased storage
  and replay, the worked "frightening dog" example, generalized replay
  producing gist as a derived/coexisting representation (not a
  replacement), and the direct citation of Prioritized Experience Replay
  (Schaul et al. 2016) as the RL/AI analog of hippocampal reweighting.
- McGaugh, J.L. (2004). "The Amygdala Modulates the Consolidation of
  Memories of Emotionally Arousing Experiences." *Annual Review of
  Neuroscience*, 27, 1-28. [PubMed, PMID 15217324](https://pubmed.ncbi.nlm.nih.gov/15217324/) —
  primary source for the amygdala/stress-hormone modulation-of-consolidation
  mechanism and the arousal-correlates-with-recall finding (abstract quoted
  directly above).
- LaBar, K.S., Cabeza, R. (2006). "Cognitive Neuroscience of Emotional
  Memory." *Nature Reviews Neuroscience*, 7, 54-64.
  [PubMed, PMID 16371950](https://pubmed.ncbi.nlm.nih.gov/16371950/);
  [full text PDF (Duke)](https://dibs-web01.vm.duke.edu/labar/pdfs/LaBar_Cabeza_2006.pdf) —
  companion review corroborating McGaugh's modulation hypothesis and the
  general "emotional memories last longer/resist forgetting more" claim.
- Diekelmann, S., Born, J. (2010). "The Memory Function of Sleep." *Nature
  Reviews Neuroscience*, 11, 114-126.
  [nature.com/articles/nrn2762](https://www.nature.com/articles/nrn2762) —
  standard reference for active systems consolidation (gradual,
  sleep-dependent redistribution of hippocampal traces to neocortex).
- PMC2798819, "Impact of individual differences upon emotion-induced memory
  trade-offs" ([pmc.ncbi.nlm.nih.gov/articles/PMC2798819](https://pmc.ncbi.nlm.nih.gov/articles/PMC2798819/)) —
  representative primary source for the emotion-induced central/peripheral
  memory trade-off and Easterbrook's (1959) attention-narrowing hypothesis
  (quoted directly above).
- Park, J.S., O'Brien, J., Cai, C.J., Morris, M.R., Liang, P., Bernstein,
  M.S. (2023). "Generative Agents: Interactive Simulacra of Human
  Behavior." arXiv:2304.03442. [arxiv.org/abs/2304.03442](https://arxiv.org/abs/2304.03442);
  read via [ar5iv full text](https://ar5iv.labs.arxiv.org/html/2304.03442) —
  primary source for the memory-stream architecture (per-event observation
  grain, importance/poignancy 1-10 scoring prompt, the
  recency+importance+relevance retrieval formula with exact weights/decay
  constant, and the reflection-tree mechanism with citation pointers back
  to source observations).
- Packer, C., et al. (2023). "MemGPT: Towards LLMs as Operating Systems."
  arXiv:2310.08560. [arxiv.org/abs/2310.08560](https://arxiv.org/abs/2310.08560);
  read via [ar5iv full text](https://ar5iv.labs.arxiv.org/html/2310.08560) —
  primary source for the contrasting Recall/Archival memory design
  (verbatim per-message storage, token-budget-triggered eviction +
  recursive summarization, no importance/salience weighting mechanism).
- Schaul, T., Quan, J., Antonoglou, I., Silver, D. (2016). "Prioritized
  Experience Replay." ICLR 2016 / arXiv:1511.05952 — cited via Kumaran,
  Hassabis & McClelland (2016) as the reinforcement-learning analog of
  hippocampal salience-biased replay; not independently re-fetched, cited
  as referenced within the primary CLS-updated source above.

## Not pursued further

- **Exact numeric replication of Generative Agents' constants** (decay
  factor 0.995/hour, reflection threshold 150, equal α-weights) as
  literal defaults for this project — flagged in the recommendation as a
  reasonable *starting point* only; those constants were tuned for a
  simulated 25-agent town running on in-game hours, not a companion
  chatbot's real-time turn-based medium, and should be recalibrated the
  same way ticket 04 already rescaled ALMA's real-time constants for a
  turn-based chat medium.
- **Deep dive into MemGPT's successor (Letta) or other 2024-2026
  memory-agent frameworks** (e.g. LangChain memory modules, Mem0) — out of
  scope; the ticket specifically asked to ground this in "an established
  computational analog... in memory-augmented LLM agent architectures,"
  and Generative Agents + MemGPT were the two named examples and remain
  the two most citable, original-paper-backed reference architectures for
  this specific question (episodic-grain storage + salience-weighted
  retrieval vs. verbatim storage + no salience weighting).
- **Full-text retrieval of Diekelmann & Born (2010) beyond the abstract
  page** — the fetch redirected through a Nature authentication wall;
  the paper's core claims used here (active systems consolidation,
  sleep-dependent gradual redistribution to neocortex) are standard,
  uncontested textbook material corroborated by both McClelland et al.
  (1995) and Kumaran et al. (2016) above, so a secondary attempt at the
  paywalled full text was judged not to change the conclusion.
