import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repo root — two levels up from this file (server/src -> server -> repo root). */
export const REPO_ROOT = path.resolve(here, "..", "..");

/** Root directory holding one subdirectory per Character, per ticket 10. */
export const DATA_DIR = path.join(REPO_ROOT, "data");

/** Root directory holding sourced avatar-image sets, per ticket 13. */
export const AVATARS_DIR = path.join(REPO_ROOT, "assets", "avatars");
