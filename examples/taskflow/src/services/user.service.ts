// User profile reads and updates. Never exposes password hashes.

import { NotFoundError } from "../lib/errors";
import { userRepository } from "../repositories/user.repository";
import { toPublicUser } from "../models/user.model";
import type { PublicUser } from "../models/user.model";

export class UserService {
  getById(id: string): PublicUser {
    const user = userRepository.findById(id);
    if (!user) throw new NotFoundError("user", id);
    return toPublicUser(user);
  }

  list(): PublicUser[] {
    return userRepository.list().map(toPublicUser);
  }

  rename(id: string, displayName: string): PublicUser {
    const user = userRepository.findById(id);
    if (!user) throw new NotFoundError("user", id);
    user.displayName = displayName;
    user.updatedAt = new Date().toISOString();
    userRepository.update(user);
    return toPublicUser(user);
  }
}

export const userService = new UserService();
