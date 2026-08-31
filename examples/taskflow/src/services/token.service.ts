// Issues and validates bearer tokens backed by the session store. The raw token
// is returned once at issue time; only its fingerprint is ever persisted.

import { randomToken, fingerprint } from "../lib/hash";
import { sessionRepository } from "../repositories/session.repository";
import { makeSession, isExpired } from "../models/session.model";
import type { Session } from "../models/session.model";

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 24; // 24h

export class TokenService {
  constructor(private readonly ttlMs: number = DEFAULT_TTL_MS) {}

  /** Create a session for a user and return the plaintext bearer token. */
  issue(userId: string): { token: string; session: Session } {
    const token = randomToken();
    const session = makeSession({
      userId,
      tokenFingerprint: fingerprint(token),
      ttlMs: this.ttlMs,
    });
    sessionRepository.insert(session);
    return { token, session };
  }

  /** Resolve a bearer token to its owning user id, or null if invalid/expired. */
  resolve(token: string): string | null {
    const session = sessionRepository.findByFingerprint(fingerprint(token));
    if (!session) return null;
    if (isExpired(session)) {
      sessionRepository.delete(session.id);
      return null;
    }
    return session.userId;
  }

  revoke(token: string): void {
    const session = sessionRepository.findByFingerprint(fingerprint(token));
    if (session) sessionRepository.delete(session.id);
  }

  revokeAll(userId: string): number {
    return sessionRepository.deleteForUser(userId);
  }
}

export const tokenService = new TokenService();
