# Established emotion-simulation models

Type: research
Status: resolved

## Question

What established computational models of emotion (e.g. PAD/pleasure-arousal-
dominance, OCC appraisal theory, Plutchik's wheel, needs-based models like
those used in The Sims) are commonly used to simulate emotional state in
games, virtual companions, or chatbots — and which of them naturally support:

- gradual buildup of an emotion from repeated small stimuli
- a fast spike for a single extreme stimulus
- decay that is slower than buildup
- representing differing *magnitudes*/intensities of the same emotion,
  not just its presence or absence

Survey the mechanics (state representation, update rules, decay functions)
of 2-4 of the most relevant models with enough concrete detail that
[ticket 04](04-emotion-model-design.md) can pick one (or a hybrid) and
define exact parameters from it, rather than inventing a model from
scratch. Capture citations/sources.

## Answer

Full findings: [../research/01-emotion-simulation-models.md](../research/01-emotion-simulation-models.md).

Surveyed PAD (via Mehrabian's original dimensions and the ALMA
implementation), OCC appraisal theory (via Bartneck 2002 and Steunebrink et
al. 2009), Plutchik's psychoevolutionary model (primary 1980 chapter), and
The Sims' motive system. No single model natively satisfies all four
mechanical requirements. **Recommendation**: a hybrid — PAD's continuous
3D state space ([-1,1] per dimension) combined with ALMA's two-speed
dynamics (a fast-decaying, event-triggered "emotion" signal for spikes,
riding on a slow "mood" that gets pulled *and pushed further* by sustained
same-direction emotion, satisfying gradual buildup and slow decay), with
Plutchik's 8-primary-emotions × 3-intensity-levels structure providing a
ready-made discrete bucketing scheme for mapping state to pre-made avatar
art. OCC is the weakest fit for this ticket's *temporal* requirements (no
native decay, no history function, no blending — all explicitly flagged as
missing by its own implementers) despite being strong on appraisal richness;
The Sims' system is decay-only by default with no spike mechanic and its
asymmetric-decay claim couldn't be confirmed from available sources. ALMA's
own published config gives concrete starting constants: ~20s emotion decay,
~10min mood-return-to-baseline, linear/exponential/tan-hyperbolic decay
shapes all supported.
