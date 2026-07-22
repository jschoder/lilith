# Established emotion-simulation models: survey

Findings for [issue 01](../issues/01-emotion-simulation-models-research.md). Feeds
[ticket 04](../issues/04-emotion-model-design.md).

## Question recap

Which established computational models of emotion naturally support:

1. gradual buildup of an emotion from repeated small stimuli
2. a fast spike for a single extreme stimulus
3. decay slower than buildup
4. representing differing magnitudes/intensities of the same emotion, not
   just presence/absence

Four models were surveyed: **PAD** (as operationalized by ALMA), **OCC**
appraisal theory, **Plutchik's model**, and **The Sims'** needs/motive system.

---

## 1. PAD (Pleasure–Arousal–Dominance)

**Origin**: Albert Mehrabian and James A. Russell, developed from 1974
onward as a general framework for describing temperament and emotional
state ([Mehrabian, "Pleasure-arousal-dominance: A general framework for
describing and measuring individual differences in
Temperament"](https://link.springer.com/article/10.1007/BF02686918),
*Current Psychology* 14, 1996, 261–292 — the paper ALMA cites as its source).

### State representation

Three continuous, "nearly independent" numeric dimensions, each in a fixed
range:

- **Pleasure** (pleasure–displeasure): happy ↔ unhappy
- **Arousal** (arousal–nonarousal): physical/mental activation, sleepy ↔
  frantic — explicitly *not* the same axis as emotional intensity (grief is
  low-arousal but intense)
- **Dominance** (dominance–submissiveness): in-control ↔ overwhelmed

A concrete implementation, [ALMA (Gebhard, 2005)](https://alma.dfki.de/papers/aamas05.pdf),
uses the range **[-1.0, 1.0]** per axis, and buckets the resulting 3D point
into one of 8 named octants (e.g. +P+A+D = "Exuberant", -P-A-D = "Bored") —
directly relevant to a "map emotion state to closest pre-made avatar image"
requirement. Source: ALMA §3, Table 1.

The raw PAD model itself (per [Wikipedia's summary of Mehrabian's
work](https://en.wikipedia.org/wiki/PAD_emotional_state_model), cross-checked
against the ALMA paper) has **no built-in temporal dynamics** — it's a
snapshot space, not a simulation. Any buildup/decay/spike behavior has to be
added on top, which is exactly what ALMA and the related WASABI architecture
(Becker-Asano) do.

### Update rules (via ALMA's operationalization)

ALMA layers **mood** (medium-term, PAD-valued) on top of discrete
**emotions** (short-term, OCC-typed) using a "pull-and-push" function
(ALMA §3, Figure 2):

1. Every appraised event produces an OCC emotion instance with an intensity,
   which is mapped into a PAD point via a fixed emotion→PAD table (ALMA
   Table 2, e.g. Joy = P0.4/A0.2/D0.1, Anger = P-0.51/A0.59/D0.25).
2. All currently-active emotions are averaged into a single **virtual
   emotion center** (a point in PAD space, intensity = mean of active
   emotions' intensities, capped at 1.0).
3. If the current mood sits *between* the PAD origin and the virtual
   emotion center, mood is pulled toward the center (**pull phase**).
4. If the mood has reached or passed the center, it's pushed *further* into
   that mood octant (**push phase**) — this is the literal mechanism for
   "repeated similar stimuli increase magnitude, not just re-trigger
   presence."
5. Absent any active emotions, mood drifts back toward a personality-derived
   default mood.

### Decay function

Two independent decay processes, both explicit, configurable parameters in
ALMA's XML config (`AffectComputation` block, ALMA Figure 3 — real values
shown, not placeholders):

- **Emotion decay**: `EmotionDecay time="20000" period="500"
  function="linear"` — each discrete emotion decays to zero over 20 seconds
  (checked every 500ms), using a pluggable decay shape: **linear,
  exponential, or tan-hyperbolic** are all supported (ALMA §3, text +
  Figure 3).
- **Mood return**: `MoodReturn time="600000" period="500"` — mood drifts
  back to the character's default/baseline over **10 minutes**, i.e. two
  orders of magnitude slower than emotion decay. ALMA calls this the "usual
  mood change time."

This two-speed structure — fast, sharply-decaying emotion driving a slow,
inertial mood — is a direct, working answer to requirement #3 (decay slower
than buildup only asymmetrically true for mood vs. the momentary trigger,
see Fit below).

### Intensity/magnitude support

Native and central: PAD's "strength" is literally the vector norm of the
point (distance from origin), and ALMA explicitly buckets it into
`slightly` / `moderate` / `fully` by dividing the max distance (√3) into
thirds (ALMA §3). Every dimension is already a magnitude, not a boolean.

### Fit to the 4 requirements

| Requirement | Native to PAD? | Notes |
|---|---|---|
| Gradual buildup from repeated small stimuli | **Yes, via ALMA's push phase** | Each new same-direction emotion re-pushes mood further into the octant — this is the mechanism, not a bolt-on. |
| Fast spike from one extreme stimulus | **Yes** | A single high-intensity emotion produces a virtual emotion center far from origin, pulling mood sharply; separately, the *emotion* layer itself is a fast, standalone spike (20s decay in ALMA's tuning) riding on top of the slower mood. |
| Decay slower than buildup | **Yes, but asymmetry is between layers, not within one** | Emotion (fast in, fast decay) vs. mood (slow in via push, slow out via 10-min return) — the model gets the *feel* of slow decay by having mood forget slowly, not by literally making decay slower than the buildup rate on the same variable. If the ticket wants literal same-variable asymmetric rates, this needs adaptation. |
| Differing magnitudes | **Yes, natively** | Vector norm = intensity; continuous by construction. |

---

## 2. OCC appraisal theory

**Origin**: Andrew Ortony, Gerald Clore, Allan Collins, *The Cognitive
Structure of Emotions*, Cambridge University Press, 1988. Not read directly
(no accessible full text found), but its structure is reproduced faithfully
and cross-checked across two independent papers read in full:
[Bartneck (2002), "Integrating the OCC Model of Emotions in Embodied
Characters"](https://www.bartneck.de/publications/2002/integratingTheOCCModel/bartneckHF2002.pdf)
and [Steunebrink, Dastani & Meyer (2009), "The OCC Model
Revisited"](https://people.idsia.ch/~steunebrink/Publications/KI09_OCC_revisited.pdf).

### State representation

22 discrete emotion **categories** (Joy, Distress, Hope, Fear, Pride, Shame,
Admiration, Reproach, Gratification, Remorse, Gratitude, Anger, Love, Hate,
etc.), organized in a strict taxonomy by what's being reacted to:
**consequences of events**, **actions of agents**, or **aspects of
objects** (Steunebrink et al., Table 1 reproduces all 22 verbatim from the
book). Each category has its own **local intensity variable(s)** — there is
no single shared magnitude scale across categories (Bartneck §2.2;
Steunebrink et al. §2, point 3: "global variables... that affect all
emotions are not included").

Examples of intensity variables, straight from the book (via Steunebrink et
al., Table 1/Fig 1): Fear's intensity is driven by *(1) degree the event is
undesirable, (2) likelihood of the event*; Love/Hate's is driven by
*appealingness* and *familiarity*; Pride/Shame by *praiseworthiness* and
*strength of cognitive unit* (self vs. other).

### Update rules

OCC itself only specifies a **one-shot classification+intensity** step per
event (Bartneck's "five phases": Classification → Quantification →
Interaction → Mapping → Expression). Two structural gaps matter for this
ticket's requirements, both explicitly flagged by Bartneck as *missing from
the original model*, not part of it:

- **No history function.** OCC has no native memory of prior events. Bartneck
  argues one is required for believability and proposes bolting on a
  "history function" that decreases the *likelihood* variable (and hence
  the computed desirability/intensity) for repeated similar events — his
  literal example: "if the user gives the character one banana after the
  other in a short interval then the desirability of each of these events
  must decrease over time... After a certain period of not receiving any
  bananas the likelihood will fall back to its original default value"
  (Bartneck §2.2). This is diminishing-returns behavior for repetition, not
  buildup — the opposite direction from what this ticket wants, and a sign
  that OCC's native mechanics actively fight requirement #1 unless
  redesigned.
- **No interaction/blending function.** OCC doesn't define how a new
  event's emotional value combines with existing emotional state — Bartneck
  again proposes this has to be invented ("Little is known how this
  interaction might work, but a very simple approach could be to counter
  effect of the positive and negative categories," §2.3).

### Decay function

**None specified in the original model.** Neither Bartneck nor Steunebrink
et al. mention a decay function; OCC concerns itself only with *how much
intensity an event produces on classification*, not how that intensity
evolves afterward. (This is precisely the gap ALMA fills by adding its own
PAD-space decay machinery on top of OCC-typed emotions — see Model 1.)

### Intensity/magnitude support

Present but **fragmented**: every emotion type has its own list of
local intensity-affecting variables (Steunebrink et al., "the idea is that
higher values for these variables result in higher emotional intensities"),
but there's no unified cross-category magnitude and no specified combination
formula — Ortony himself later acknowledged the 22-category model is
likely too complex for practical character-building and suggested collapsing
to 10 categories (Bartneck §2.1, citing Ortony 2003).

### Fit to the 4 requirements

| Requirement | Native to OCC? | Notes |
|---|---|---|
| Gradual buildup from repeated small stimuli | **No — actively works against it** | The documented "history function" pattern *reduces* desirability/intensity on repetition (diminishing returns / habituation), not buildup. Would need deliberate inversion. |
| Fast spike from one extreme stimulus | **Partially** | A single classification pass can produce arbitrarily high intensity if the local variables (desirability, likelihood, etc.) are extreme — this part works — but there's no notion of "spike vs. sustained" since there's no decay to spike away from. |
| Decay slower than buildup | **No** | No decay function exists at all; would be 100% invented. |
| Differing magnitudes | **Partial, per-category only** | Each of the 22 types has its own local intensity, but no shared scale to compare/aggregate across categories without inventing one. |

OCC's real strength is *why* an emotion should fire (rich, structured
appraisal conditions) — its weakness is everything about *how it evolves
over time*, which is exactly this ticket's concern. Every source that
implements OCC computationally (Bartneck's eMuu, ALMA/EmotionEngine) does so
by pairing it with a second, separate dynamics model (usually PAD-based) for
the temporal part.

### GAMYGDALA — a second, concrete OCC operationalization (with real update equations)

To check whether *some* OCC implementation solves the buildup/decay gap
better than Bartneck's, [Popescu, Broekens & van Someren, "GAMYGDALA: An
Emotion Engine for Games," *IEEE Transactions on Affective Computing*, 5(1),
2014, 32–44](https://ii.tudelft.nl/~joostb/files/Popescu_Broekens_Someren_2013.pdf)
was read directly (full 6-page paper). It confirms and sharpens the picture
above rather than contradicting it:

- **Desirability formula (paper's Eq. 1), read directly from the source**:
  `desirability(b, g, p) = congruence(b, g) * utility(g)`, where each NPC
  defines goals with a `utility ∈ [-1, 1]`, and each incoming event/belief
  has a `congruence ∈ [-1, 1]` toward each goal it affects. This is a real,
  continuous, per-agent-relative intensity formula — stronger and more
  concrete than the "local intensity variables" Bartneck/Steunebrink
  describe abstractly.
- **Combining repeated appraisals**: GAMYGDALA borrows a **logarithmic
  combination function** from Reilly's "Em" model specifically so that
  "accumulating emotional intensity is linear for lower values and less
  additive as values increase" — i.e., this *is* a genuine buildup
  mechanism for repeated stimuli (unlike Bartneck's habituation-only
  "history function" above), but it saturates (diminishing returns) rather
  than growing unboundedly — relevant if requirement #1's "gradual buildup"
  should taper off rather than escalate indefinitely.
- **"Expectedness"** (a feature GAMYGDALA borrows from Reilly and documents
  explicitly): an event with likelihood 0.9 that occurs produces a *lower*
  intensity emotion than a fully unexpected event of equal severity, even
  though the belief's final likelihood is 1 in both cases. This is a
  built-in vehicle for requirement #2 (a fast spike specifically for
  surprising/extreme stimuli, distinct from foreseeable ones).
- **Decay**: the paper states intensities "decay over time as specified by
  the Emotion Decay Functions" and separately documents (again citing
  Reilly) a **"different decay per emotion type"** feature — e.g. hope and
  fear are meant to decay at different rates — but, unlike ALMA, the fetched
  paper does not give closed-form decay equations or constants. Exact rates
  would require the GAMYGDALA source code, not the paper.

Net effect on the recommendation below: OCC-as-GAMYGDALA is a better answer
to requirements #1, #2 and #4 than OCC-as-Bartneck (concrete formula,
genuine buildup via log-combination, explicit expectedness-driven spike
support) — the one gap that persists across *every* OCC operationalization
found, including this one, is a documented, concrete decay curve.

---

## 3. Plutchik's model (psychoevolutionary theory / "wheel of emotions")

**Origin**: Robert Plutchik, "A General Psychoevolutionary Theory of
Emotion," in *Emotion: Theory, Research, and Experience, Vol. 1*, Academic
Press, 1980 (chapter read in full via PDF). Also summarized secondarily by
[Six Seconds](https://www.uvm.edu/~mjk/013%20Intro%20to%20Wildlife%20Tracking/Plutchik's%20Wheel%20of%20Emotions%20-%202017%20Update%20_%20Six%20Seconds.pdf)
and [Wikiversity](https://en.wikiversity.org/wiki/Motivation_and_emotion/Book/2014/Plutchik's_wheel_of_emotions)
for the visual/cone structure, cross-checked against the primary chapter.

### State representation

**8 primary emotions** arranged as **4 bipolar opposite pairs**: joy↔sadness,
trust↔disgust, fear↔anger, surprise↔anticipation (Plutchik 1980, Postulate 8:
"Primary emotions can be conceptualized in terms of pairs of polar
opposites"). All other emotions are **derived combinations ("dyads")** of
adjacent primaries — Postulate 6: "All other emotions are mixed or
derivative states... combinations, mixtures, or compounds of the primary
emotions."

Crucially for this ticket, **Postulate 10** states directly (primary
source, p. 9): *"Each emotion can exist in varying degrees of intensity or
levels of arousal."* Intensity is a first-class part of the model's
foundational postulates, not an afterthought.

Visually/structurally this is represented as a **cone**: the circular
arrangement of the 8 primaries encodes *similarity* (adjacent = similar,
opposite = polar), and a *vertical* axis on the cone encodes **intensity** —
more intense variants sit toward the cone's apex/center, weaker variants
toward the rim. Each primary emotion has **3 named intensity levels** (24
named nuances total) — e.g. the joy family, from weak to strong, is
serenity → joy → ecstasy (per the wheel structure; this specific graded
labeling is standard secondary-source material describing Plutchik's
diagrams, not quoted verbatim from the 1980 chapter excerpt read here, so
treat the *existence* of the 3-level-per-primary structure as
primary-sourced via Postulate 10, and the specific label set as
secondary-sourced).

### Update rules / decay function

**Not specified as formulas** in the theoretical chapter — Plutchik's 1980
work is explicitly a *structural/taxonomic* theory (what emotions exist, how
they relate, why evolutionarily) rather than a computational/simulation
model with update equations. No stimulus-response formula or decay curve is
given in the source. This means Plutchik supplies **vocabulary and
structure** (which discrete emotions exist, how they're related, that
intensity is continuous and multi-level) but **no ready-made dynamics** —
any buildup/decay/spike mechanic would be entirely invented on top, same gap
as OCC.

### Intensity/magnitude support

**Strong, and explicitly foundational** (Postulate 10) — more directly
built into the model's core claims than either PAD or OCC. The
practical benefit for this project: intensity levels already have a
natural mapping to discrete buckets (3 named levels per primary emotion),
which lines up well with "map emotion state to closest pre-made avatar
image."

### Fit to the 4 requirements

| Requirement | Native to Plutchik? | Notes |
|---|---|---|
| Gradual buildup from repeated small stimuli | **No mechanism specified** | Structural theory only; would be entirely invented. |
| Fast spike from one extreme stimulus | **No mechanism specified** | Same gap. |
| Decay slower than buildup | **No mechanism specified** | No temporal dynamics in the source at all. |
| Differing magnitudes | **Yes — the strongest native fit of the three "psychological" models surveyed** | 3-level intensity per primary emotion is explicit and foundational (Postulate 10), with a ready-made discrete bucketing that suits avatar-art mapping particularly well. |

---

## 4. The Sims' needs/motive system

**Origin**: Game-industry system, not academic — Maxis, *The Sims* (2000)
and sequels. No original design paper is publicly available; documented via
[Mark Brown (Game Maker's Toolkit), "The Genius AI Behind The
Sims"](https://gmtk.substack.com/p/the-genius-ai-behind-the-sims) (game-dev
postmortem-style writeup, acceptable per this ticket's sourcing note since
it's a game-industry system without an academic primary source) and a
[GDC Vault talk, "Emergent Storytelling Techniques in 'The
Sims'"](https://www.gdcvault.com/play/1025112/Emergent-Storytelling-Techniques-in-The)
covering the same system across four generations of the franchise (talk
itself is paywalled/not fetched; listed for reference as the closest thing
to a primary industry source).

### State representation

8 independent **motives** in *The Sims 1* — hunger, hygiene, bladder,
energy, fun, social, comfort, room/tidiness — each a scalar on a **fixed
range of -100 to +100**. Overall "happiness"/mood is a combination of all
motives (Brown's article states this but doesn't reproduce Maxis' internal
weighting formula, so the exact aggregation function is not publicly
documented).

### Update rules

Motives **tick down continuously** in the background (pure decay, not
event-driven spikes) and are **replenished by the player directing the Sim
to a relevant action/object** (eating restores hunger, sleeping restores
energy, etc.). Decay rate is **per-motive and context-sensitive**: e.g. "the
bladder meter drops more quickly when the Sim is eating." Decay rates were
hand-tuned by Maxis to match real-world human schedules — "needing eight
hours of sleep, and three meals a day" (Brown).

When not player-directed, Sims autonomously choose actions using utility-style
decision-making: A* pathfinding toward the highest-ranked object by impact on
happiness, with need priority informed by Maslow's hierarchy, and factoring
in distance, personality, other Sims, and current mood (Brown).

### Decay function

Continuous linear-per-tick depletion (framed as "meters... constantly
ticking down" at "slightly different rates" per motive) — no exponential or
other curve is documented in the sources found. **No asymmetry between
depletion and replenishment rate is documented** — replenishment appears to
be driven by the duration/effectiveness of the chosen action rather than a
separately-tuned "recovery rate," so this system does **not** demonstrate
requirement #3 (decay slower than buildup) in any citable, concrete way from
the sources available. This is the weakest-sourced area of this survey —
flagged explicitly rather than guessed at.

### Intensity/magnitude support

**Yes, natively and simply**: every motive is already a continuous
[-100, +100] scalar, so magnitude is the default representation, not
bolted on.

### Fit to the 4 requirements

| Requirement | Native to Sims motives? | Notes |
|---|---|---|
| Gradual buildup from repeated small stimuli | **Partial** | Motives move gradually by construction (continuous decay/refill), but the *system's own default direction* is decay-only; "buildup" only happens via direct player/AI-chosen replenishing actions, not from passive repeated small stimuli the way an emotion like "affection" would build from repeated small positive interactions. |
| Fast spike from one extreme stimulus | **Not really supported** | The system has no single-event spike mechanic — motives move via ongoing actions over time, not instantaneous jumps from one event. |
| Decay slower than buildup | **Not documented** | No source found specifies asymmetric rates; likely tuned per-motive in the shipped game but not publicly disclosed. |
| Differing magnitudes | **Yes, natively** | Continuous scalar range is the whole point of the system. |

---

## Recommendation

**No single model satisfies all four requirements out of the box.** The
clearest, best-sourced path is a **hybrid built on PAD's operationalized
form (as ALMA demonstrates), not a plain textbook PAD, OCC, or Plutchik
implementation**:

- Use **continuous scalar dimensions** (PAD-style, or even simpler:
  per-emotion scalars) as the state representation — this is the only way
  requirement #4 (differing magnitudes) is satisfied *natively* by more than
  one surveyed model, and PAD/Plutchik both build it in from the ground up
  rather than requiring invention.
- Borrow **ALMA's two-speed structure** directly: a fast-decaying,
  event-triggered "emotion" signal (satisfies requirement #2, the spike) and
  a slow-moving "mood"/baseline that gets pulled and *pushed further* by
  sustained same-direction emotion (satisfies requirements #1 and #3 — this
  push-phase mechanic is the single most directly reusable piece of
  machinery found in this survey, with a concrete config shape already
  published: linear/exponential/tan-hyperbolic decay, a ~20s emotion decay
  constant, and a ~10min mood-return constant in ALMA's own tuning, all
  adjustable).
- If discrete named emotion *categories* are wanted (e.g. for picking
  avatar art), **Plutchik's 8 primaries + 3-level intensity buckets** is the
  better fit than OCC's 22 categories — it's simpler, its intensity levels
  are foundational rather than bolted on, and its structure already
  suggests a natural bucketing scheme for "map emotion state to the closest
  pre-made image."
- **OCC is the weakest fit for this specific ticket's mechanical
  requirements, even in its best operationalization (GAMYGDALA).** Its
  appraisal-condition richness (deciding *whether and why* an event produces
  pride vs. admiration vs. gratitude) is valuable for a
  *goals-and-relationships*-driven companion, and GAMYGDALA's
  `desirability = congruence * utility` formula plus its logarithmic
  buildup and expectedness-driven spike are genuinely reusable pieces — but
  no OCC operationalization found (Bartneck's, GAMYGDALA's, or ALMA's own
  EmotionEngine) documents a concrete decay curve for OCC emotions
  themselves; every one of them either omits decay or hands the decayed
  variable off to a *separate* PAD-mood layer. If OCC-style rich appraisal
  is wanted for *why* an emotion fires, it should be paired with
  PAD/ALMA-style dynamics for *how it evolves*, exactly as ALMA itself does
  — not used alone.
- **The Sims' motive system is a good secondary reference for a *needs* or
  *goals* subsystem** (ticket 09, not this one) but is a poor fit as the
  primary *emotion*-dynamics model — its decay-only default direction and
  lack of a spike mechanic don't match what this ticket is asking for, and
  the asymmetric-decay claim couldn't be confirmed from available sources.

**Suggested starting point for ticket 04**: PAD state space (3 continuous
dimensions, [-1, 1] each), ALMA-style two-layer dynamics (fast emotion decay
+ slow push/pull mood with a longer return-to-baseline time), with Plutchik's
8-primary/3-level structure as the discrete bucketing scheme for driving
avatar selection.

---

## References

- Mehrabian, A. (1996). "Pleasure-arousal-dominance: A general framework for
  describing and measuring individual differences in Temperament."
  *Current Psychology*, 14, 261–292.
  https://link.springer.com/article/10.1007/BF02686918
- "PAD emotional state model." Wikipedia.
  https://en.wikipedia.org/wiki/PAD_emotional_state_model
- Gebhard, P. (2005). "ALMA – A Layered Model of Affect." *Proceedings of
  AAMAS'05*, Utrecht, Netherlands.
  https://alma.dfki.de/papers/aamas05.pdf
- Ortony, A., Clore, G., & Collins, A. (1988). *The Cognitive Structure of
  Emotions*. Cambridge University Press. (Not read directly — reconstructed
  faithfully via the two papers below, which reproduce its tables and
  structure.)
- Bartneck, C. (2002). "Integrating the OCC Model of Emotions in Embodied
  Characters." *Proceedings of the Workshop on Virtual Conversational
  Characters*, Melbourne.
  https://www.bartneck.de/publications/2002/integratingTheOCCModel/bartneckHF2002.pdf
- Steunebrink, B. R., Dastani, M., & Meyer, J.-J. Ch. (2009). "The OCC Model
  Revisited." https://people.idsia.ch/~steunebrink/Publications/KI09_OCC_revisited.pdf
- Popescu, A., Broekens, J., & van Someren, M. (2014). "GAMYGDALA: An
  Emotion Engine for Games." *IEEE Transactions on Affective Computing*,
  5(1), 32–44. Read directly in full (6 pp.):
  https://ii.tudelft.nl/~joostb/files/Popescu_Broekens_Someren_2013.pdf
- Plutchik, R. (1980). "A General Psychoevolutionary Theory of Emotion." In
  *Emotion: Theory, Research, and Experience, Vol. 1: Theories of Emotion*.
  Academic Press.
- "Plutchik's Wheel of Emotions - 2017 Update." Six Seconds.
  https://www.uvm.edu/~mjk/013%20Intro%20to%20Wildlife%20Tracking/Plutchik's%20Wheel%20of%20Emotions%20-%202017%20Update%20_%20Six%20Seconds.pdf
  (secondary source, used only for the visual/label structure of the
  intensity cone, cross-checked against Plutchik 1980's Postulate 10)
- "Motivation and emotion/Book/2014/Plutchik's wheel of emotions."
  Wikiversity.
  https://en.wikiversity.org/wiki/Motivation_and_emotion/Book/2014/Plutchik's_wheel_of_emotions
  (secondary source, same use as above)
- Brown, M. "The Genius AI Behind The Sims." Game Maker's Toolkit
  (Substack). https://gmtk.substack.com/p/the-genius-ai-behind-the-sims
  (game-industry secondary source; no academic primary source exists for
  this proprietary system)
- "Emergent Storytelling Techniques in 'The Sims'." GDC Vault.
  https://www.gdcvault.com/play/1025112/Emergent-Storytelling-Techniques-in-The
  (listed for reference; not fetched — paywalled)

## Not pursued further

- **WASABI (Becker-Asano)**: a more advanced PAD-based dynamics model
  (adds an explicit "boredom" axis and primary/secondary emotion
  distinction) that likely refines the two-speed push/pull idea further.
  Located via search but not read in full — ALMA already supplied enough
  concrete, citable mechanics to answer this ticket's question. Worth a
  follow-up read if ticket 04 wants to go deeper on the exact PAD dynamics
  before finalizing parameters.
