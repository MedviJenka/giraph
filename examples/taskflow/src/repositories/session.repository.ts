// Data access for sessions. Sessions are keyed by a token fingerprint so lookups
// during authentication are O(1).

import { BaseRepository } from "./base.repository";
import type { Session } from "../models/session.model";

export class SessionRepository extends BaseRepository<"sessions", Session> {
  constructor() {
    super("sessions");
  }

  findByFingerprint(fingerprint: string): Session | null {
    return this.where((s) => s.tokenFingerprint === fingerprint)[0] ?? null;
  }

  deleteForUser(userId: string): number {
    const owned = this.where((s) => s.userId === userId);
    for (const session of owned) this.delete(session.id);
    return owned.length;
  }
}

export const sessionRepository = new SessionRepository();
