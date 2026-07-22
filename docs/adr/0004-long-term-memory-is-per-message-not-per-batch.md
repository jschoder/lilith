# Long-term memory is stored per-message, not per-batch

The alternative to per-message Long-term Memory rows was one row per
compressed batch, with a single embedding covering several Messages —
cheaper to store and embed. We chose per-message rows instead, each with
its own embedding, with Memory Summaries layered additively on top as
citations back to their source Messages rather than replacements for them.
This is grounded in [ticket 14](../../.scratch/chatbot/research/14-human-memory-consolidation.md)'s
research: both the neuroscience (Complementary Learning Systems theory —
hippocampal event-level encoding, with neocortical gist extracted later and
additively) and the closest LLM-agent analog (Generative Agents' per-event
memory stream with reflection-generated summaries that cite their sources)
converge on event grain as the primary store. Per-message grain also
preserves retrieval precision — a specific old exchange can surface even
when the rest of its batch isn't relevant.
