import type { Client } from "@libsql/client";
import { parseEmotionVector, serializeEmotionVector, zeroEmotionVector } from "../domain/plutchik.js";
import type { EmotionMoodState } from "./dynamics.js";

/**
 * A Character's persisted Emotion/Mood state (ticket 18) — a singleton row
 * (`id = 1`), read-modify-written by each turn's Appraisal. Lives in
 * `character.db` alongside `messages`/`minor_goals`, per the per-character
 * DB-file isolation locked in by the map.
 */
export const CREATE_EMOTION_STATE_TABLE = `
  CREATE TABLE emotion_state (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    emotion    TEXT NOT NULL,
    mood       TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL
  )
`;

export interface PersistedEmotionState {
  state: EmotionMoodState;
  updatedAt: string;
}

interface EmotionStateRow {
  emotion: string;
  mood: string;
  updated_at: string;
}

/** Seeds the singleton row at Character creation — both layers start at zero, per ticket 12's avatar tie-break design. */
export async function initializeEmotionState(db: Client, createdAt: string): Promise<void> {
  const zero = serializeEmotionVector(zeroEmotionVector());
  await db.execute({
    sql: `INSERT INTO emotion_state (id, emotion, mood, updated_at) VALUES (1, ?, ?, ?)`,
    args: [zero, zero, createdAt],
  });
}

export async function readEmotionState(db: Client): Promise<PersistedEmotionState> {
  const result = await db.execute("SELECT emotion, mood, updated_at FROM emotion_state WHERE id = 1");
  const row = result.rows[0] as unknown as EmotionStateRow;
  return {
    state: {
      emotion: parseEmotionVector(row.emotion),
      mood: parseEmotionVector(row.mood),
    },
    updatedAt: row.updated_at,
  };
}

export async function writeEmotionState(db: Client, state: EmotionMoodState, updatedAt: string): Promise<void> {
  await db.execute({
    sql: `UPDATE emotion_state SET emotion = ?, mood = ?, updated_at = ? WHERE id = 1`,
    args: [serializeEmotionVector(state.emotion), serializeEmotionVector(state.mood), updatedAt],
  });
}
