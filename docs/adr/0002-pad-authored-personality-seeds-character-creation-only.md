# PAD-authored personality seeds character creation only

Even though runtime emotion state is a pure Plutchik vector (ADR-0001),
PAD is still used once, at character-creation time: a character's
personality is authored as a single PAD (pleasure/arousal/dominance)
point — Mehrabian's original use of PAD was for describing temperament,
which fits an authoring step better than a runtime mechanism — and
projected through a canonical Plutchik-primary↔PAD coordinate table
(built from ALMA's own OCC→PAD table plus hand-assigned coordinates for
the rest) into two things: the character's Baseline Mood vector, and
default per-emotion buildup-gain/decay-half-life constants.

After creation, the PAD point and the projection are never used again —
they're discarded, not stored as ongoing state.

This is a deliberate deviation from the surveyed literature: no source
in ticket 01's research describes using PAD as a personality-authoring
shorthand that seeds a separate discrete-emotion model. The
PAD→gain/decay-seeding heuristic specifically is invented for this
project, not sourced — a future reader should not assume it traces back
to ALMA or Plutchik.
