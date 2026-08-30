import type { Blueprint, ArchitectureWarning, NodeType } from "../types";

/**
 * Architecture rule engine (PLAN.md §Phase 6 rules.yaml / §11 Architecture Rules).
 *
 * Rule `layer_violation`: an API Endpoint must reach the data store through a
 * Service. A direct dependency/call from an "API Endpoint" node to a
 * "Repository Layer" or "Database Model" node bypasses the service layer.
 */
const LAYERING_TARGETS: Partial<Record<NodeType, true>> = {
  "Repository Layer": true,
  "Database Model": true,
};

const LAYERING_EDGES: Record<string, true> = { depends_on: true, calls: true };

export function detectWarnings(blueprint: Blueprint): ArchitectureWarning[] {
  const byId = new Map(blueprint.nodes.map((n) => [n.id, n]));
  const warnings: ArchitectureWarning[] = [];

  for (const edge of blueprint.edges) {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) continue;

    if (
      source.type === "API Endpoint" &&
      LAYERING_TARGETS[target.type] &&
      LAYERING_EDGES[edge.relationship]
    ) {
      warnings.push({
        id: `layer_violation:${edge.source}->${edge.target}`,
        rule: "layer_violation",
        message: `${source.name} (${source.type}) depends directly on ${target.name} (${target.type}), bypassing the Service layer.`,
        nodeIds: [edge.source, edge.target],
      });
    }
  }

  return warnings;
}

/** Set of node ids implicated in any warning. */
export function warnedNodeIds(warnings: ArchitectureWarning[]): Set<string> {
  const ids = new Set<string>();
  for (const w of warnings) for (const id of w.nodeIds) ids.add(id);
  return ids;
}
