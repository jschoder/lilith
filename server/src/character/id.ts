import { randomBytes } from "node:crypto";

const ID_BYTES = 24; // 192 bits, base64url-encoded to 32 chars

/**
 * Mints a Character ID directly from a CSPRNG (never derived or hashed
 * from any other input, per ADR-0013) — it doubles as the on-disk storage
 * key and the entire `/chat/{id}` access-control mechanism.
 */
export function mintCharacterId(): string {
  return randomBytes(ID_BYTES).toString("base64url");
}

const VALID_ID = /^[A-Za-z0-9_-]+$/;

/** Guards against path traversal before an id is ever used to build a filesystem path. */
export function isWellFormedCharacterId(id: string): boolean {
  return VALID_ID.test(id);
}
