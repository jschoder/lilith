# 22 — Goals system: Drive + Minor Goals lifecycle

**What to build:** The Character now visibly pursues things — a fixed Drive colors its perspective in every reply without ever being announced outright, and it spontaneously forms, completes, and retires small concrete Minor Goals as the conversation's emotional arc develops, all judged by the same per-turn call that already produces the Emotion Stimulus. Landing this after avatar and memory means the judgment call has real Emotion/Mood/memory context to react to.

**Blocked by:** 18, 19, 20, 21

**Status:** ready-for-agent

- [ ] The Character's single hardwired Drive is injected into every generation prompt via phrasing alone (no explicit "state your goal" instruction), set once at creation with no runtime mutation path.
- [ ] Goal lifecycle transitions `(currentGoals, llmJudgment) -> nextGoals` are a pure, independently-testable function covering spawn, completion, and retirement.
- [ ] The same per-turn LLM call extended in this ticket judges Minor Goal completion/retirement/spawning and produces its own Emotion Stimulus for that outcome, in the same call that already does Appraisal — no separate planning/scoring loop.
- [ ] A spawned Minor Goal's importance is `spawn_intensity` decaying exponentially from `spawned_at` (same shape as Mood decay), computed on the fly, never re-boosted.
- [ ] When active Minor Goals exceed the configured concurrent-active cap, the lowest-importance one is auto-retired.
- [ ] `minor_goals` rows are never deleted, only status-transitioned with `ended_at` set.
- [ ] An integration test drives a full conversation arc where a goal spawns, then either completes or retires, and confirms both the `minor_goals` row transition and the resulting Emotion Stimulus.
