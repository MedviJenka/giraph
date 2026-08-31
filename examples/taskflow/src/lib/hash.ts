// Password + token hashing. Uses Node's scrypt so the sample has no third-party
// crypto dependency while still demonstrating a realistic auth flow.

import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";

const KEYLEN = 32;

/** Hash a plaintext password into a `salt:derived` string safe to persist. */
export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(plain, salt, KEYLEN).toString("hex");
  return `${salt}:${derived}`;
}

/** Constant-time verification of a plaintext against a stored hash. */
export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, derived] = stored.split(":");
  if (!salt || !derived) return false;
  const candidate = scryptSync(plain, salt, KEYLEN);
  const expected = Buffer.from(derived, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/** Opaque, URL-safe token used for sessions. */
export function randomToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Deterministic fingerprint so we can index tokens without storing them raw. */
export function fingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
