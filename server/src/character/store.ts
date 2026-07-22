import { createClient, type Client } from "@libsql/client";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { CREATE_MESSAGES_TABLE } from "../conversation/messages.js";
import { isWellFormedCharacterId } from "./id.js";
import type { CharacterDefinition } from "./types.js";

const CREATE_MINOR_GOALS_TABLE = `
  CREATE TABLE minor_goals (
    id              INTEGER PRIMARY KEY,
    text            TEXT NOT NULL,
    status          TEXT NOT NULL,
    spawn_intensity REAL NOT NULL,
    spawned_at      TIMESTAMP NOT NULL,
    ended_at        TIMESTAMP
  )
`;

export function characterDir(id: string, dataDir: string): string {
  return path.join(dataDir, id);
}

function dbPath(id: string, dataDir: string): string {
  return path.join(characterDir(id, dataDir), "character.db");
}

/** Opens an already-created Character's `character.db` — see `writeCharacterDirectory` for schema creation. */
export function openCharacterDb(id: string, dataDir: string): Client {
  return createClient({ url: `file:${dbPath(id, dataDir)}` });
}

/** Opens a Character's `character.db` for the duration of `fn`, closing it afterward regardless of outcome. */
export async function withCharacterDb<T>(
  id: string,
  dataDir: string,
  fn: (db: Client) => Promise<T>,
): Promise<T> {
  const db = openCharacterDb(id, dataDir);
  try {
    return await fn(db);
  } finally {
    db.close();
  }
}

interface WriteOptions {
  /** Injection point for tests to simulate a DB-open failure deterministically. */
  openDb?: (dbPath: string) => Client;
}

/**
 * Writes a Character's `definition.json`, `character.db` (with empty
 * `minor_goals` and `messages` tables), and `character.log` together. If
 * any step fails, the whole directory is removed — no partial Character is
 * ever left on disk, per ticket 16.
 */
export async function writeCharacterDirectory(
  definition: CharacterDefinition,
  dataDir: string,
  options: WriteOptions = {},
): Promise<void> {
  const openDb = options.openDb ?? ((file: string) => createClient({ url: `file:${file}` }));
  const dir = characterDir(definition.id, dataDir);

  await mkdir(dir, { recursive: true });
  try {
    await writeFile(path.join(dir, "definition.json"), JSON.stringify(definition, null, 2), "utf8");
    await writeFile(path.join(dir, "character.log"), "", "utf8");

    const db = openDb(dbPath(definition.id, dataDir));
    try {
      await db.execute(CREATE_MINOR_GOALS_TABLE);
      await db.execute(CREATE_MESSAGES_TABLE);
    } finally {
      db.close();
    }
  } catch (err) {
    await rm(dir, { recursive: true, force: true });
    throw err;
  }
}

export async function readCharacterDefinition(
  id: string,
  dataDir: string,
): Promise<CharacterDefinition | null> {
  if (!isWellFormedCharacterId(id)) {
    return null;
  }
  try {
    const raw = await readFile(path.join(characterDir(id, dataDir), "definition.json"), "utf8");
    return JSON.parse(raw) as CharacterDefinition;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw err;
  }
}
