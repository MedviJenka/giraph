// Registration, login, and request authentication. Orchestrates the user
// repository, password hashing, and the token service.

import { hashPassword, verifyPassword } from "../lib/hash";
import { ConflictError, UnauthorizedError } from "../lib/errors";
import { userRepository } from "../repositories/user.repository";
import { tokenService } from "./token.service";
import { makeUser, toPublicUser } from "../models/user.model";
import type { PublicUser } from "../models/user.model";

export interface Credentials {
  email: string;
  password: string;
}

export interface AuthResult {
  user: PublicUser;
  token: string;
}

export class AuthService {
  register(email: string, displayName: string, password: string): AuthResult {
    if (userRepository.existsByEmail(email)) {
      throw new ConflictError("email already registered");
    }
    const user = makeUser({ email, displayName, passwordHash: hashPassword(password) });
    userRepository.insert(user);
    const { token } = tokenService.issue(user.id);
    return { user: toPublicUser(user), token };
  }

  login(credentials: Credentials): AuthResult {
    const user = userRepository.findByEmail(credentials.email);
    if (!user || !verifyPassword(credentials.password, user.passwordHash)) {
      throw new UnauthorizedError("invalid email or password");
    }
    const { token } = tokenService.issue(user.id);
    return { user: toPublicUser(user), token };
  }

  logout(token: string): void {
    tokenService.revoke(token);
  }

  /** Resolve a bearer token to a user id or throw 401. Used as middleware. */
  authenticate(token: string | undefined): string {
    const userId = token ? tokenService.resolve(token) : null;
    if (!userId) throw new UnauthorizedError();
    return userId;
  }
}

export const authService = new AuthService();
