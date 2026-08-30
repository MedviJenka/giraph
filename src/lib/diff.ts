import type { Blueprint, ChangeSet, ChangeKind } from "../types";

/**
 * Compare two blueprint snapshots (PLAN.md §9 Agent Change Tracking).
 * - added: ids present in `current` but not `previous`
 * - removed: ids present in `previous` but not `current`
 * - modified: ids in both whose `signature` differs
 */
export function diffBlueprints(previous: Blueprint, current: Blueprint): ChangeSet {
  const prevById = new Map(previous.nodes.map((n) => [n.id, n]));
  const currById = new Map(current.nodes.map((n) => [n.id, n]));

  const added = current.nodes.filter((n) => !prevById.has(n.id));
  const removed = previous.nodes.filter((n) => !currById.has(n.id));
  const modified = current.nodes.filter((n) => {
    const prev = prevById.get(n.id);
    return prev !== undefined && prev.signature !== n.signature;
  });

  return { added, removed, modified };
}

/** Classify a single node id against a change set. */
export function nodeChangeKind(nodeId: string, changes: ChangeSet): ChangeKind {
  if (changes.added.some((n) => n.id === nodeId)) return "added";
  if (changes.removed.some((n) => n.id === nodeId)) return "removed";
  if (changes.modified.some((n) => n.id === nodeId)) return "modified";
  return "unchanged";
}

export const changeSymbol: Record<ChangeKind, string> = {
  added: "+",
  removed: "-",
  modified: "~",
  unchanged: "",
};

/** Total count of changed (non-unchanged) nodes. */
export function changeCount(changes: ChangeSet): number {
  return changes.added.length + changes.removed.length + changes.modified.length;
}
