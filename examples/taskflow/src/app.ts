// Application entry point. Boots the store, seeds a demo dataset, and exercises
// the API through the composition root so the sample runs end-to-end with
// `node --experimental-strip-types src/app.ts` (or after a tsc build).

import { connect } from "./db/connection";
import { handleRequest } from "./api/index";
import { logger } from "./lib/logger";
import type { HttpRequest, Method } from "./lib/http";

const log = logger.child("app");

async function call(
  method: Method,
  path: string,
  body: unknown = null,
  token?: string,
): Promise<{ status: number; body: unknown }> {
  const req: HttpRequest = {
    method,
    path,
    params: {},
    query: {},
    headers: token ? { authorization: token } : {},
    body,
  };
  const res = await handleRequest(req);
  log.info(`${method} ${path}`, { status: res.status });
  return res;
}

/** Runtime-checked read of a string field from an untyped API response body. */
function readStringField(body: unknown, key: string): string {
  if (body && typeof body === "object" && key in body) {
    // Guarded above as a non-null object; index dynamically as a JSON-like record.
    const record = body as Record<string, unknown>;
    const value = record[key];
    if (typeof value === "string") return value;
  }
  throw new Error(`expected string field "${key}" in response body`);
}

async function main(): Promise<void> {
  connect();

  const reg = await call("POST", "/auth/register", {
    email: "ada@example.com",
    displayName: "Ada Lovelace",
    password: "correct horse battery staple",
  });
  const token = readStringField(reg.body, "token");

  const project = await call("POST", "/projects", { name: "Analytical Engine" }, token);
  const projectId = readStringField(project.body, "id");

  await call("POST", "/tasks", { projectId, title: "Draft Note G", priority: "high" }, token);
  await call("GET", `/tasks/project/${projectId}`, null, token);

  log.info("demo run complete");
}

main().catch((err) => {
  log.error("fatal", { err: String(err) });
  process.exitCode = 1;
});
