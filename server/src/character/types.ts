import type { EmotionConstantsVector, EmotionVector, PadPoint } from "../domain/plutchik.js";

/**
 * A Character's complete authored + derived record, persisted as
 * `data/{id}/definition.json`. See ticket 10.
 */
export interface CharacterDefinition {
  id: string;
  name: string;
  personalityDescription: string;
  drive: string;
  avatarSet: string;
  /** One-shot creation input, kept only for reference — never read again at runtime. */
  emotionalTendency: string;
  /** One-shot creation input, kept only for reference — never read again at runtime. */
  personalityPoint: PadPoint;
  baselineMood: EmotionVector;
  emotionConstants: EmotionConstantsVector;
}
