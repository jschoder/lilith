import { createClient, type Client } from "@libsql/client";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
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

interface WriteOptions {
  /** Injection point for tests to simulate a DB-open failure deterministically. */
  openDb?: (dbPath: string) => Client;
}

/**
 * Writes a Character's `definition.json`, `character.db` (with an empty
 * `minor_goals` table), and `character.log` together. If any step fails,
 * the whole directory is removed — no partial Character is ever left on
 * disk, per ticket 16.
 */
export async function writeCharacterDirectory(
  definition: CharacterDefinition,
  dataDir: string,
  options: WriteOptions = {},
): Promise<void> {
  const openDb = options.openDb ?? ((dbPath: string) => createClient({ url: `file:${dbPath}` }));
  const dir = characterDir(definition.id, dataDir);

  await mkdir(dir, { recursive: true });
  try {
    await writeFile(path.join(dir, "definition.json"), JSON.stringify(definition, null, 2), "utf8");
    await writeFile(path.join(dir, "character.log"), "", "utf8");

    const db = openDb(path.join(dir, "character.db"));
    try {
      await db.execute(CREATE_MINOR_GOALS_TABLE);
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
