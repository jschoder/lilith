# gemma3:12b is the chat/appraisal/goal-judgment model

The single Ollama-served LLM behind the character's reply generation and
the piggybacked per-turn Appraisal + Minor Goal judgment call ([ADR-0012](0012-goal-lifecycle-piggybacks-on-emotion-appraisal.md))
is `gemma3:12b`.

The deciding constraint is the operator's actual deployment hardware: an
RTX 3060 12GB, the same machine the embedding-model research in
[research/03-ollama-embedding-models.md](../../.scratch/chatbot/research/03-ollama-embedding-models.md)
measured against. At Q4_K_M quantization, `gemma3:12b` needs roughly
7-8GB VRAM, leaving comfortable headroom on a 12GB card for
`nomic-embed-text` (negligible, ~274MB) plus KV cache for a multi-turn
context window — without that headroom, prompt-length growth from
retrieved Long-term Memory would risk falling back to partial CPU
offload and losing the GPU-accelerated latency the embedding research
already measured.

The "Not yet specified" concern this closes — whether the model's
structured-output support is reliable enough for the piggybacked
Appraisal + Minor Goal JSON call — turns out to be mostly a
tooling-layer question, not a model-choice one: Ollama's `format`
parameter (0.3.0+) accepts a full JSON Schema and constrains decoding
directly via grammar, rather than relying on the model to follow a
formatting instruction unprompted. That works for any modern
instruction-tuned model Ollama serves, `gemma3:12b` included. What
still varies by model is judgment quality — whether the emotions/intensities
and goal spawn/complete/retire calls it produces are *sensible* — not
JSON conformance, and `gemma3:12b` is a solid general-purpose pick on
that front.

## Considered options

- **`qwen3:14b`.** Comparable or arguably stronger structured-output/
  function-calling training, but ~9-10GB at Q4_K_M — noticeably less
  VRAM headroom on this specific 12GB card. Left as the fallback if
  `gemma3:12b`'s appraisal/goal-judgment quality turns out inadequate in
  practice.
- **`mistral-nemo` (12B).** Frequently cited for strong prose/roleplay
  quality specifically, which matters for a companion chatbot's reply
  generation. Not chosen as the default because it's less consistently
  recommended for the structured-output half of the piggybacked call;
  worth revisiting if reply quality (as opposed to appraisal accuracy)
  becomes the bottleneck.

## Consequences

- Quantization is assumed to be the `gemma3:12b` tag's default
  (Q4_K_M) pending an empirical benchmark on the actual RTX 3060 — the
  embedding research measured real `curl`/`ollama ps` latency rather
  than trusting vendor numbers, and this model choice should get the
  same treatment before being relied on.
- Ollama's default context window (`num_ctx`) is much smaller than
  `gemma3:12b`'s architectural maximum; the still-open "total per-turn
  prompt token ceiling" item (map.md, spec.md Further Notes) needs to
  pick and set an explicit `num_ctx`, not assume the model's max is
  available for free.
- `gemma3:12b`'s multimodal (image) capability goes unused — this
  project has no image-input requirement, so it's not a factor either
  way.
- If `qwen3:14b` is swapped in later for judgment-quality reasons, the
  VRAM headroom margin shrinks; that tradeoff should be re-evaluated
  against actual measured behavior, not assumed upfront.
