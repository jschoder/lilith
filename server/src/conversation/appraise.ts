import { withCharacterDb } from "../character/store.js";
import type { CharacterDefinition } from "../character/types.js";
import { PLUTCHIK_PRIMARIES, type EmotionVector } from "../domain/plutchik.js";
import { appraiseTurn } from "../emotion/appraisal.js";
import { advanceEmotionMood } from "../emotion/dynamics.js";
import { readEmotionState, writeEmotionState } from "../emotion/store.js";
import type { LlmPort } from "../llm/port.js";
import { updateMessageEmotion, type StoredMessage } from "./messages.js";

function peakIntensity(vector: EmotionVector): number {
  return Math.max(...PLUTCHIK_PRIMARIES.map((primary) => vector[primary]));
}

/**
 * Runs the post-reply background job's Appraisal half (ADR-0008; ticket
 * 20's compression-trigger check is the other half, not yet implemented):
 * one sparse LLM Appraisal of the turn, applied to the Character's
 * persisted Emotion/Mood state, then snapshotted onto both of the turn's
 * new message rows (ticket 04 — appraisal runs per turn, not per message,
 * but every affected row gets the resulting Emotion-layer snapshot).
 */
export async function appraiseAndPersist(
  character: CharacterDefinition,
  dataDir: string,
  userMessage: StoredMessage,
  replyMessage: StoredMessage,
  llm: LlmPort,
): Promise<void> {
  const stimulus = await appraiseTurn(character, userMessage.text, replyMessage.text, llm);

  await withCharacterDb(character.id, dataDir, async (db) => {
    const { state, updatedAt } = await readEmotionState(db);
    const now = new Date();
    const elapsedMs = now.getTime() - Date.parse(updatedAt);
    const next = advanceEmotionMood(state, elapsedMs, stimulus, character.emotionConstants);

    await writeEmotionState(db, next, now.toISOString());

    const intensity = peakIntensity(next.emotion);
    await updateMessageEmotion(db, userMessage.id, next.emotion, intensity);
    await updateMessageEmotion(db, replyMessage.id, next.emotion, intensity);
  });
}
