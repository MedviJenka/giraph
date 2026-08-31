// Generic CRUD over a single in-memory collection. Concrete repositories extend
// this and add their entity-specific query methods.

import { connect } from "../db/connection";
import type { Store } from "../db/connection";

type Collections = {
  [K in keyof Store]: Store[K] extends Map<string, infer V> ? V : never;
};

export abstract class BaseRepository<K extends keyof Store, T extends Collections[K] & { id: string }> {
  protected constructor(private readonly collection: K) {}

  protected map(): Map<string, T> {
    return connect()[this.collection] as unknown as Map<string, T>;
  }

  insert(entity: T): T {
    this.map().set(entity.id, entity);
    return entity;
  }

  findById(id: string): T | null {
    return this.map().get(id) ?? null;
  }

  list(): T[] {
    return [...this.map().values()];
  }

  update(entity: T): T {
    this.map().set(entity.id, entity);
    return entity;
  }

  delete(id: string): boolean {
    return this.map().delete(id);
  }

  protected where(predicate: (entity: T) => boolean): T[] {
    return this.list().filter(predicate);
  }
}
