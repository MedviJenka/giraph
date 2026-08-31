// Data access for users, including the email uniqueness lookup the auth service
// relies on during registration.

import { BaseRepository } from "./base.repository";
import type { User } from "../models/user.model";

export class UserRepository extends BaseRepository<"users", User> {
  constructor() {
    super("users");
  }

  findByEmail(email: string): User | null {
    const needle = email.toLowerCase();
    return this.where((u) => u.email === needle)[0] ?? null;
  }

  existsByEmail(email: string): boolean {
    return this.findByEmail(email) !== null;
  }
}

export const userRepository = new UserRepository();
