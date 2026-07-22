import { withCharacterDb } from "../character/store.js";
import type { CharacterDefinition } from "../character/types.js";
import type { LlmPort } from "../llm/port.js";
import { generateReply } from "./generate.js";
import { appendMessage, listMessages, type StoredMessage } from "./messages.js";

export function persistUserMessage(
  character: CharacterDefinition,
  dataDir: string,
  text: string,
): Promise<StoredMessage> {
  return withCharacterDb(character.id, dataDir, (db) => appendMessage(db, "user", text));
}

/**
 * Reads the latest message history, generates one complete reply, and
 * persists it. History is re-read fresh on every call so a restarted
 * generation (ADR-0009) sees any messages that arrived since the last
 * attempt.
 */
export function generateAndPersistReply(
  character: CharacterDefinition,
  dataDir: string,
  llm: LlmPort,
  signal: AbortSignal,
): Promise<StoredMessage> {
  return withCharacterDb(character.id, dataDir, async (db) => {
    const history = await listMessages(db);
    const reply = await generateReply(character, history, llm, signal);
    return appendMessage(db, "character", reply);
  });
}
