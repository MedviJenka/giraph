// Boundary validation helpers. Services call these on untrusted input so that a
// ValidationError (422) surfaces cleanly instead of a downstream type error.

import { ValidationError } from "./errors";

export function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

export function asOptionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return asString(value, field);
}

export function asEmail(value: unknown): string {
  const email = asString(value, "email").toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new ValidationError("email is not a valid address");
  }
  return email;
}

export function asEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  const raw = asString(value, field);
  if (!allowed.includes(raw as T)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(", ")}`);
  }
  return raw as T;
}

export function requireObject(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ValidationError("request body must be an object");
  }
  return value as Record<string, unknown>;
}
