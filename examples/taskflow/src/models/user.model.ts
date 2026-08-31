// User database model. The `passwordHash` never leaves the repository layer in
// raw form; services project it away before returning to the API.

import { newId, now } from "../lib/id";

export type UserRole = "member" | "admin";

export interface User {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

/** Public projection of a user — safe to serialise over the API. */
export type PublicUser = Omit<User, "passwordHash">;

export interface NewUser {
  email: string;
  displayName: string;
  passwordHash: string;
  role?: UserRole;
}

export function makeUser(input: NewUser): User {
  const ts = now();
  return {
    id: newId("usr"),
    email: input.email,
    displayName: input.displayName,
    passwordHash: input.passwordHash,
    role: input.role ?? "member",
    createdAt: ts,
    updatedAt: ts,
  };
}

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _omit, ...rest } = user;
  return rest;
}
