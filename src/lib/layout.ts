import type { Node, Edge } from "reactflow";
import type {
  Blueprint,
  BlueprintNode,
  ChangeSet,
  ChangeKind,
  ArchitectureWarning,
} from "../types";
import { nodeChangeKind } from "./diff";
import { warnedNodeIds } from "./rules";

/** Payload attached to each React Flow node, consumed by the custom node view. */
export interface BlueprintNodeData {
  blueprint: BlueprintNode;
  change: ChangeKind;
  warned: boolean;
  /** Node is the search/selection focus (or a direct dependency of the selection). */
  focused: boolean;
  /** Something is focused elsewhere and this node is not part of it. */
  dimmed: boolean;
}

export type BlueprintFlowNode = Node<BlueprintNodeData>;

export interface FlowData {
  nodes: BlueprintFlowNode[];
  edges: Edge[];
}

export interface LayoutOptions {
  changes: ChangeSet;
  warnings: ArchitectureWarning[];
  /** Case-insensitive substring matched against name/type/path. */
  search: string;
  /** Currently selected node id, or null. */
  selectedId: string | null;
}

const LAYER_HEIGHT = 130;
const COLUMN_WIDTH = 220;

/**
 * Assign each node a layer = longest dependency distance from a root.
 * Roots are nodes with no incoming edge. Cycle-safe: a node is only pushed
 * deeper, and each node is finalized once, so a back-edge cannot loop forever.
 */
function assignLayers(blueprint: Blueprint): Map<string, number> {
  const incoming = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const n of blueprint.nodes) {
    incoming.set(n.id, 0);
    adjacency.set(n.id, []);
  }
  for (const e of blueprint.edges) {
    if (!incoming.has(e.source) || !incoming.has(e.target)) continue;
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
    adjacency.get(e.source)!.push(e.target);
  }

  const layer = new Map<string, number>();
  const queue: string[] = [];
  for (const n of blueprint.nodes) {
    if ((incoming.get(n.id) ?? 0) === 0) {
      layer.set(n.id, 0);
      queue.push(n.id);
    }
  }
  // Fallback for pure cycles with no root: seed the first node at layer 0.
  if (queue.length === 0 && blueprint.nodes.length > 0) {
    layer.set(blueprint.nodes[0].id, 0);
    queue.push(blueprint.nodes[0].id);
  }

  const remaining = new Map(incoming);
  while (queue.length > 0) {
    const id = queue.shift()!;
    const depth = layer.get(id) ?? 0;
    for (const next of adjacency.get(id) ?? []) {
      layer.set(next, Math.max(layer.get(next) ?? 0, depth + 1));
      const left = (remaining.get(next) ?? 0) - 1;
      remaining.set(next, left);
      if (left <= 0) queue.push(next);
    }
  }

  for (const n of blueprint.nodes) if (!layer.has(n.id)) layer.set(n.id, 0);
  return layer;
}

/** Ids connected to `selectedId` by an edge in either direction, plus itself. */
function neighborhood(blueprint: Blueprint, selectedId: string): Set<string> {
  const ids = new Set<string>([selectedId]);
  for (const e of blueprint.edges) {
    if (e.source === selectedId) ids.add(e.target);
    if (e.target === selectedId) ids.add(e.source);
  }
  return ids;
}

export function toFlow(blueprint: Blueprint, opts: LayoutOptions): FlowData {
  const { changes, warnings, search, selectedId } = opts;
  const layer = assignLayers(blueprint);
  const warned = warnedNodeIds(warnings);

  const perLayerIndex = new Map<number, number>();
  const query = search.trim().toLowerCase();
  const focusIds = selectedId ? neighborhood(blueprint, selectedId) : null;

  const nodes: BlueprintFlowNode[] = blueprint.nodes.map((bp) => {
    const depth = layer.get(bp.id) ?? 0;
    const column = perLayerIndex.get(depth) ?? 0;
    perLayerIndex.set(depth, column + 1);

    const matchesSearch =
      query.length > 0 &&
      (bp.name.toLowerCase().includes(query) ||
        bp.type.toLowerCase().includes(query) ||
        bp.path.toLowerCase().includes(query));

    const focused = matchesSearch || (focusIds?.has(bp.id) ?? false);
    const hasFocus = query.length > 0 || focusIds !== null;

    return {
      id: bp.id,
      type: "blueprintNode",
      position: { x: column * COLUMN_WIDTH, y: depth * LAYER_HEIGHT },
      data: {
        blueprint: bp,
        change: nodeChangeKind(bp.id, changes),
        warned: warned.has(bp.id),
        focused,
        dimmed: hasFocus && !focused,
      },
    };
  });

  const edges: Edge[] = blueprint.edges.map((e) => {
    const isViolation = warnings.some(
      (w) => w.nodeIds.includes(e.source) && w.nodeIds.includes(e.target),
    );
    const active =
      focusIds !== null && (focusIds.has(e.source) || focusIds.has(e.target));
    return {
      id: `${e.source}->${e.target}:${e.relationship}`,
      source: e.source,
      target: e.target,
      label: e.relationship,
      animated: active,
      style: {
        stroke: isViolation ? "#dc2626" : active ? "#2563eb" : "#94a3b8",
        strokeWidth: isViolation || active ? 2 : 1,
        opacity: focusIds !== null && !active ? 0.25 : 1,
        strokeDasharray: isViolation ? "6 4" : undefined,
      },
      labelStyle: { fontSize: 10, fill: "#cbd5e1" },
      labelBgStyle: { fill: "#0f172a", fillOpacity: 0.85 },
      markerEnd: isViolation
        ? "edge-dot-violation"
        : active
          ? "edge-dot-active"
          : "edge-dot",
    };
  });

  return { nodes, edges };
}
