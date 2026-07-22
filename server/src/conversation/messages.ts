import type { Client } from "@libsql/client";
import { zeroEmotionVector, type EmotionVector } from "../domain/plutchik.js";

export type MessageSender = "user" | "character";

/**
 * The atomic conversation-storage unit (ADR-0003): a single permanent
 * `messages` table serves as Short-term Memory (a live query over its
 * uncompressed tail) and Long-term Memory (the same rows once Compressed
 * by ticket 20). `emotion_vector`/`peak_emotion_intensity` start as
 * placeholders and are filled in by ticket 18's background Appraisal.
 */
export const CREATE_MESSAGES_TABLE = `
  CREATE TABLE messages (
    id                     INTEGER PRIMARY KEY,
    sender                 TEXT NOT NULL,
    text                   TEXT NOT NULL,
    created_at             TIMESTAMP NOT NULL,
    emotion_vector         TEXT NOT NULL,
    peak_emotion_intensity REAL NOT NULL
  )
`;

export interface StoredMessage {
  id: number;
  sender: MessageSender;
  text: string;
  createdAt: string;
  emotionVector: EmotionVector;
  peakEmotionIntensity: number;
}

interface MessageRow {
  id: number;
  sender: string;
  text: string;
  created_at: string;
  emotion_vector: string;
  peak_emotion_intensity: number;
}

function fromRow(row: MessageRow): StoredMessage {
  return {
    id: row.id,
    sender: row.sender as MessageSender,
    text: row.text,
    createdAt: row.created_at,
    emotionVector: JSON.parse(row.emotion_vector) as EmotionVector,
    peakEmotionIntensity: row.peak_emotion_intensity,
  };
}

export async function appendMessage(db: Client, sender: MessageSender, text: string): Promise<StoredMessage> {
  const createdAt = new Date().toISOString();
  const emotionVector = zeroEmotionVector();
  const peakEmotionIntensity = 0;

  const result = await db.execute({
    sql: `INSERT INTO messages (sender, text, created_at, emotion_vector, peak_emotion_intensity) VALUES (?, ?, ?, ?, ?)`,
    args: [sender, text, createdAt, JSON.stringify(emotionVector), peakEmotionIntensity],
  });

  return { id: Number(result.lastInsertRowid), sender, text, createdAt, emotionVector, peakEmotionIntensity };
}

/** Full message log in chronological order — no token-budget windowing yet (ticket 20/21). */
export async function listMessages(db: Client): Promise<StoredMessage[]> {
  const result = await db.execute("SELECT * FROM messages ORDER BY id ASC");
  return (result.rows as unknown as MessageRow[]).map(fromRow);
}
