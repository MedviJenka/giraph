// Session database model. Stores only a fingerprint of the bearer token so a
// database leak never exposes usable credentials.

import { now } from "../lib/id";
import type { User } from "./user.model";

export interface Session {
  id: string;
  userId: User["id"];
  tokenFingerprint: string;
  createdAt: string;
  expiresAt: string;
}

export interface NewSession {
  userId: string;
  tokenFingerprint: string;
  ttlMs: number;
}

export function makeSession(input: NewSession): Session {
  const createdAt = now();
  const expiresAt = new Date(Date.now() + input.ttlMs).toISOString();
  return {
    id: input.tokenFingerprint.slice(0, 16),
    userId: input.userId,
    tokenFingerprint: input.tokenFingerprint,
    createdAt,
    expiresAt,
  };
}

export function isExpired(session: Session, at: number = Date.now()): boolean {
  return new Date(session.expiresAt).getTime() <= at;
}
