import { readdir } from "node:fs/promises";
import { AVATARS_DIR } from "../paths.js";

/** Names of sourced avatar-image sets an operator can pick at character creation (ticket 13). */
export async function listAvatarSets(): Promise<string[]> {
  const entries = await readdir(AVATARS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}
