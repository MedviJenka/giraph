import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
} from "d3-force";
import type { Node, Edge } from "reactflow";
import type {
  Blueprint,
  BlueprintNode,
  NodeType,
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
  /** Node owns a `contains` subtree that can be folded away. */
  collapsible: boolean;
  /** The subtree is currently folded. */
  collapsed: boolean;
  /** Count of descendants hidden while collapsed (0 when expanded). */
  hiddenCount: number;
  /** Fold/unfold this node's subtree. Injected by the canvas, not the layout. */
  onToggleCollapse?: (id: string) => void;
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
  /** Node types the user has toggled off; matching nodes are removed. */
  hiddenTypes: Set<NodeType>;
  /** Directory/repository ids whose `contains` subtree is folded away. */
  collapsedDirs: Set<string>;
}

const NODE_W = 190;
const NODE_H = 64;

/** Deterministic PRNG (mulberry32) so the layout is identical across rescans. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit FNV-1a hash of a node id, used to seed its initial placement. */
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
}

interface SimLink {
  source: string;
  target: string;
}

/**
 * Solve a force simulation to a deterministic rest state: linked nodes pull
 * together, everything else repels, producing an organic "neural" scatter
 * instead of a rigid grid. Determinism (same topology -> same coordinates) is
 * a hard requirement — live rescans must not reshuffle the canvas and dragged
 * positions must stay meaningful.
 */
function computePositions(blueprint: Blueprint): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();
  const n = blueprint.nodes.length;
  if (n === 0) return result;

  // Seed each node on a spiral keyed by its id: identical graphs settle
  // identically, and adding one file barely perturbs the existing ones.
  const radius = Math.max(260, Math.sqrt(n) * 130);
  const simNodes: SimNode[] = blueprint.nodes.map((bp) => {
    const rand = mulberry32(hashId(bp.id));
    const angle = rand() * Math.PI * 2;
    const dist = Math.sqrt(rand()) * radius;
    return { id: bp.id, x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
  });

  const known = new Set(simNodes.map((s) => s.id));
  const links: SimLink[] = blueprint.edges
    .filter((e) => known.has(e.source) && known.has(e.target))
    .map((e) => ({ source: e.source, target: e.target }));

  // forceCollide jiggles coincident nodes via Math.random; seed the global RNG
  // for the offline solve so the whole run is reproducible, then restore it.
  const realRandom = Math.random;
  Math.random = mulberry32(0x9e3779b9);
  try {
    const sim = forceSimulation<SimNode>(simNodes)
      .force("charge", forceManyBody<SimNode>().strength(-480))
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(150)
          .strength(0.45),
      )
      .force("center", forceCenter(0, 0))
      .force("collide", forceCollide<SimNode>(Math.hypot(NODE_W, NODE_H) / 2 + 14))
      .stop();
    // Solve offline for a fixed tick budget — no animation, no per-frame cost.
    for (let i = 0; i < 320; i++) sim.tick();
  } finally {
    Math.random = realRandom;
  }

  // React Flow positions are the node's top-left; the sim yields its center.
  for (const s of simNodes) {
    result.set(s.id, { x: (s.x ?? 0) - NODE_W / 2, y: (s.y ?? 0) - NODE_H / 2 });
  }
  return result;
}

/** Topology signature: positions change only when nodes or edges change. */
function topologyKey(blueprint: Blueprint): string {
  const nodes = blueprint.nodes.map((node) => node.id).sort().join(",");
  const edges = blueprint.edges
    .map((e) => `${e.source}>${e.target}`)
    .sort()
    .join(",");
  return `${nodes}|${edges}`;
}

let positionCache: { key: string; positions: Map<string, { x: number; y: number }> } | null = null;

/** Memoized positions — the simulation reruns only when topology changes. */
function positionsFor(blueprint: Blueprint): Map<string, { x: number; y: number }> {
  const key = topologyKey(blueprint);
  if (positionCache && positionCache.key === key) return positionCache.positions;
  const positions = computePositions(blueprint);
  positionCache = { key, positions };
  return positions;
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

/** Adjacency of `contains` edges: parent id -> direct child ids. */
function containsChildren(blueprint: Blueprint): Map<string, string[]> {
  const children = new Map<string, string[]>();
  for (const e of blueprint.edges) {
    if (e.relationship !== "contains") continue;
    const list = children.get(e.source);
    if (list) list.push(e.target);
    else children.set(e.source, [e.target]);
  }
  return children;
}

/** Count of all transitive `contains` descendants of `id`. */
function descendantCount(id: string, children: Map<string, string[]>): number {
  const stack = [...(children.get(id) ?? [])];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const next = stack.pop()!;
    if (seen.has(next)) continue;
    seen.add(next);
    for (const c of children.get(next) ?? []) stack.push(c);
  }
  return seen.size;
}

/**
 * Ids that must not render: nodes of a hidden type, plus any node with a
 * collapsed ancestor in the `contains` tree. Seeding the walk from the
 * *children* of collapsed dirs (not the dirs themselves) keeps each collapsed
 * dir visible while still folding a collapsed dir that sits under another
 * collapsed dir — so "collapse all" folds cleanly down to the root.
 */
function computeHidden(
  blueprint: Blueprint,
  hiddenTypes: Set<NodeType>,
  collapsedDirs: Set<string>,
  children: Map<string, string[]>,
): Set<string> {
  const hidden = new Set<string>();
  if (hiddenTypes.size > 0) {
    for (const n of blueprint.nodes) if (hiddenTypes.has(n.type)) hidden.add(n.id);
  }
  if (collapsedDirs.size > 0) {
    const stack: string[] = [];
    for (const dir of collapsedDirs) {
      for (const child of children.get(dir) ?? []) stack.push(child);
    }
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (hidden.has(id)) continue;
      hidden.add(id);
      for (const child of children.get(id) ?? []) stack.push(child);
    }
  }
  return hidden;
}

export function toFlow(blueprint: Blueprint, opts: LayoutOptions): FlowData {
  const { changes, warnings, search, selectedId, hiddenTypes, collapsedDirs } = opts;
  const warned = warnedNodeIds(warnings);

  // Resolve visibility first: layout, positions, and edges all operate on the
  // visible subgraph so folding a directory actually compacts the canvas.
  const children = containsChildren(blueprint);
  const hidden = computeHidden(blueprint, hiddenTypes, collapsedDirs, children);
  const visibleNodes = blueprint.nodes.filter((n) => !hidden.has(n.id));
  const visibleIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = blueprint.edges.filter(
    (e) => visibleIds.has(e.source) && visibleIds.has(e.target),
  );

  const positions = positionsFor({ nodes: visibleNodes, edges: visibleEdges });

  const query = search.trim().toLowerCase();
  const focusIds = selectedId ? neighborhood(blueprint, selectedId) : null;

  const nodes: BlueprintFlowNode[] = visibleNodes.map((bp) => {
    const matchesSearch =
      query.length > 0 &&
      (bp.name.toLowerCase().includes(query) ||
        bp.type.toLowerCase().includes(query) ||
        bp.path.toLowerCase().includes(query));

    const focused = matchesSearch || (focusIds?.has(bp.id) ?? false);
    const hasFocus = query.length > 0 || focusIds !== null;
    const collapsed = collapsedDirs.has(bp.id);

    return {
      id: bp.id,
      type: "blueprintNode",
      position: positions.get(bp.id) ?? { x: 0, y: 0 },
      data: {
        blueprint: bp,
        change: nodeChangeKind(bp.id, changes),
        warned: warned.has(bp.id),
        focused,
        dimmed: hasFocus && !focused,
        collapsible: (children.get(bp.id)?.length ?? 0) > 0,
        collapsed,
        hiddenCount: collapsed ? descendantCount(bp.id, children) : 0,
      },
    };
  });

  const edges: Edge[] = visibleEdges.map((e) => {
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
