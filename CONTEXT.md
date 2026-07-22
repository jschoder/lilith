# AI Companion Chatbot

A multi-user AI companion chatbot with persistent memory, a simulated
emotion system, and per-character goals.

## Language

### Emotion & Mood

**Emotion**:
The fast-changing, short-lived layer of a character's affective state — one
scalar per Plutchik primary (joy, trust, fear, surprise, sadness, disgust,
anger, anticipation), each in [0, 1]. Reacts immediately to a stimulus and
decays back down within minutes.
_Avoid_: Feeling, reaction (as state) — reserve "emotion" for this specific
fast layer, not the character's affect in general.

**Mood**:
The slow-changing layer of a character's affective state — same 8-primary
shape as Emotion, but decays back to its Baseline Mood over hours rather
than minutes. Pulled and pushed by sustained same-direction Emotion.
_Avoid_: Vibe, disposition (that's Personality Point, a different thing).

**Baseline Mood**:
The resting Mood vector a character's Mood decays back toward when no
stimuli are occurring. Set once at character creation from the character's
Personality Point; never recomputed afterward.

**Appraisal**:
The act of judging a conversational turn and producing a Stimulus — done by
the LLM, not a separate sentiment classifier or hardcoded event table.
Sparse: only the emotions actually evoked are output (typically 1-3), not
all 8.

**Stimulus**:
The output of an Appraisal — one or more (emotion, intensity) pairs applied
to the Emotion/Mood vectors for a single conversational turn. An emotion
with no Stimulus this turn simply decays.

**Opposite pair**:
One of the four Plutchik bipolar relationships (joy↔sadness, trust↔disgust,
fear↔anger, surprise↔anticipation). A Stimulus to one member of a pair
dampens the other by a configurable suppression fraction, preventing both
from sitting at maximum simultaneously.

**Personality Point**:
A one-time PAD (pleasure/arousal/dominance) point authored when a character
is created. Used only to project a Baseline Mood and default per-emotion
buildup/decay constants — discarded after creation, never stored or
consulted at runtime.
_Avoid_: PAD state, affect point — the character has no PAD state at
runtime, only at creation time.

### Avatar

**Dominant Emotion**:
Whichever of a character's 8 Mood components has the highest raw value at
a given moment — not a deviation from Baseline Mood. Selects which of the
8 avatar image families (one per Plutchik primary) is shown. Ties between
the top components are broken by comparing those components' Baseline
Mood values (higher wins), falling back to a fixed priority order (`fear >
anger > disgust > sadness > surprise > anticipation > trust > joy`) only
if Baseline Mood also ties.
_Avoid_: Primary emotion — that's Plutchik's structural term for the 8
categories themselves, not "whichever one is currently highest."

**Intensity Tier**:
One of 3 bins (low/mid/high) the Dominant Emotion's raw Mood value falls
into — cutoffs are even thirds, a global constant in `tuning.ts`, not
derived per character. Selects which of the 3 Plutchik nuance images
within a family is shown.

**Avatar Bucket**:
The (Dominant Emotion, Intensity Tier) pair — one of a fixed, universal
24-slot taxonomy, named with Plutchik's graded nuance vocabulary (e.g.
serenity/joy/ecstasy for the joy family). Same 24 slots for every
character; only the sourced image per slot is per-character.
_Avoid_: Neutral bucket — there isn't one; the low tier of whatever's
dominant serves as the resting look.

### Memory

**Message**:
A single sent chat message — the atomic unit of conversation storage. Not
a user+character turn-pair; a rapid-fire sequence of messages from one
sender before a reply is stored as separate Messages, matching real-person
texting cadence.
_Avoid_: Turn, exchange — reserve those for describing conversational
flow, not the storage unit.

**Short-term memory**:
The live, uncompressed tail of a character's message log — recent
Messages still within the current effective token budget, injected
directly into the LLM's prompt rather than retrieved by search.
_Avoid_: Recent memory, context window (that's the LLM's own limit, a
different concept).

**Long-term memory**:
A Message that has undergone Compression: it now carries an embedding and
a Peak Emotion Intensity, and is retrieved via vector similarity search
rather than direct prompt injection.
_Avoid_: Archived memory, cold storage.

**Compression**:
The transition of a Message from Short-term to Long-term Memory — an
embedding and Peak Emotion Intensity get computed and attached to it. Raw
text is never deleted; Compression changes how a Message is used for
prompt construction, not what's stored.
_Avoid_: Eviction, deletion, archiving — none are accurate, since nothing
is removed.

**Memory Summary**:
An LLM-generated gist covering a batch of Messages Compressed together in
one pass. An additive layer that references its source Messages — it
never replaces them.
_Avoid_: Reflection (the mechanism that inspired this is called
"reflection" in the Generative Agents paper; this project's canonical
term is Memory Summary).

**Peak Emotion Intensity**:
The maximum component of a Message's Emotion vector at the moment it was
appraised. Stored per Message as a queryable salience signal — used both
as a secondary Compression trigger and as retrieval-scoring input.
_Avoid_: Emotional salience, importance (the Generative Agents paper's
term for its closest analog; this project's canonical term is Peak
Emotion Intensity).

**Retrieval Score**:
The blended value — vector similarity, recency, and Peak Emotion Intensity
combined by weighted sum — used to rank Long-term Memory for inclusion in
a turn's prompt. Computed only for Long-term Memory; Short-term Memory has
no Retrieval Score, since it's injected unconditionally rather than
ranked.
_Avoid_: Relevance score, memory rank.

### Characters

**Character**:
A single, unique companion instance — created exactly once via the
creation form and never cloned or templated per user. Its Character ID,
conversation, and state are singular; anyone holding its URL shares the
same instance.
_Avoid_: Persona, bot, template — there is no separate template a
Character is instantiated from; the Character is the one and only unit.

**Character ID**:
An unguessable token generated directly from a CSPRNG (never derived or
hashed from other input) when a Character is created. Serves as both the
on-disk storage key and the entire access-control mechanism —
`/chat/{id}` is a bearer-capability URL, and there is no separate user or
account system.
_Avoid_: User ID, session token — nothing about it identifies a user;
there is no user concept in this system, only the Character itself.

**Emotional Tendency**:
Optional free text authored once at character creation (e.g. "quick to
anger, slow to calm"), fed alongside the Personality Description into the
one-time LLM call that infers the Personality Point. Kept in the
character's definition file afterward for reference only — never reused
at runtime.
_Avoid_: Personality Description — that field is a recurring
system-prompt fragment; Emotional Tendency is consumed exactly once, at
creation, for a different purpose.

### Goals

**Drive**:
The single, hardwired want authored once at character creation (e.g.
"world domination") — a guiding star, not an achievable goal. Never
completes, carries no progress tracking, and is never mutated at runtime.
Injected into the prompt every turn, framed as a background disposition
rather than an active per-turn directive.
_Avoid_: Goal, major goal — reserve "goal" for Minor Goal, since bare
"goal" is ambiguous between the two.

**Minor Goal**:
A concrete, completable objective the Drive dynamically spawns or retires
in reaction to the character's emotional development. Carries a status —
active, Completed, or Retired — and an importance (its emotional intensity
at spawn, decaying exponentially over elapsed time) used to enforce a cap
on how many can be active at once.
_Avoid_: Task, objective, subgoal.

**Completed** (Minor Goal status):
The objective was actually achieved, judged from conversation content.
Distinct from Retired — the two are different information and produce
different emotional reactions.

**Retired** (Minor Goal status):
The Minor Goal's motivating emotional state faded (or it was evicted to
stay under the active-goal cap) before it was achieved. Distinct from
Completed.
_Avoid_: Abandoned, expired — canonical term is Retired.
