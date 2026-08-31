// In-memory "database". A single Store instance holds one Map per collection,
// standing in for tables. Swapping this for Postgres would only change this file
// plus the repository layer that reads from it.

import { logger } from "../lib/logger";
import type { User } from "../models/user.model";
import type { Project } from "../models/project.model";
import type { Task } from "../models/task.model";
import type { Session } from "../models/session.model";

export interface Store {
  users: Map<string, User>;
  projects: Map<string, Project>;
  tasks: Map<string, Task>;
  sessions: Map<string, Session>;
}

let store: Store | null = null;

/** Lazily create and return the process-wide store (a connection pool analogue). */
export function connect(): Store {
  if (store) return store;
  store = {
    users: new Map(),
    projects: new Map(),
    tasks: new Map(),
    sessions: new Map(),
  };
  logger.child("db").info("in-memory store initialised");
  return store;
}

/** Drop all data. Used by tests and the demo seeder between runs. */
export function reset(): void {
  store = null;
}
