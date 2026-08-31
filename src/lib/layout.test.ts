import { describe, it, expect } from "vitest";
import { current } from "../data/blueprint";
import { diffBlueprints } from "./diff";
import { detectWarnings } from "./rules";
import { toFlow } from "./layout";
import type { Blueprint, NodeType } from "../types";

const changes = diffBlueprints(current, current); // no changes: exercise unchanged path
const warnings = detectWarnings(current);

function base(
  search = "",
  selectedId: string | null = null,
  hiddenTypes: Set<NodeType> = new Set(),
  collapsedDirs: Set<string> = new Set(),
) {
  return toFlow(current, {
    changes,
    warnings,
    search,
    selectedId,
    hiddenTypes,
    collapsedDirs,
  });
}

describe("toFlow", () => {
  it("maps every blueprint node and edge", () => {
    const { nodes, edges } = base();
    expect(nodes).toHaveLength(current.nodes.length);
    expect(edges).toHaveLength(current.edges.length);
  });

  it("removes nodes of a filtered-out type and their edges", () => {
    const { nodes, edges } = base("", null, new Set<NodeType>(["Service"]));
    expect(nodes.some((n) => n.data.blueprint.type === "Service")).toBe(false);
    // The 3 Service nodes (auth/user/token) and every edge touching them go.
    expect(nodes).toHaveLength(current.nodes.length - 3);
    expect(edges.some((e) => e.source.endsWith("Service") || e.target.endsWith("Service"))).toBe(
      false,
    );
  });

  it("is deterministic and spreads nodes apart", () => {
    const a = base().nodes;
    const b = base().nodes;
    // Identical topology must yield identical coordinates: live rescans and
    // dragged positions depend on the layout not reshuffling.
    for (let i = 0; i < a.length; i++) {
      expect(b[i].position).toEqual(a[i].position);
    }
    // The force layout must actually separate nodes (collide radius), never
    // stack them at one point like a degenerate solve.
    const slots = new Set(
      a.map((n) => `${Math.round(n.position.x)},${Math.round(n.position.y)}`),
    );
    expect(slots.size).toBe(a.length);
  });

  it("marks warned nodes so the view can flag them", () => {
    const { nodes } = base();
    expect(nodes.find((n) => n.id === "userRepository")!.data.warned).toBe(true);
    expect(nodes.find((n) => n.id === "userService")!.data.warned).toBe(false);
  });

  it("focuses search matches and dims the rest", () => {
    const { nodes } = base("auth");
    const authService = nodes.find((n) => n.id === "authService")!;
    const userService = nodes.find((n) => n.id === "userService")!;
    expect(authService.data.focused).toBe(true);
    expect(authService.data.dimmed).toBe(false);
    expect(userService.data.focused).toBe(false);
    expect(userService.data.dimmed).toBe(true);
  });

  it("highlights the selected node's neighborhood", () => {
    const { nodes } = base("", "authService");
    // authService connects to tokenService, userRepository, and authRouter.
    expect(nodes.find((n) => n.id === "tokenService")!.data.focused).toBe(true);
    expect(nodes.find((n) => n.id === "userModel")!.data.dimmed).toBe(true);
  });

  it("renders the layer-violation edge in the warning color", () => {
    const { edges } = base();
    const violation = edges.find((e) => e.id === "authRouter->userRepository:depends_on")!;
    expect(violation.style?.stroke).toBe("#dc2626");
  });
});

describe("toFlow folding", () => {
  const tree: Blueprint = {
    nodes: [
      { id: "root", type: "Directory", name: "root", path: "root", language: "", description: "", signature: "" },
      { id: "a", type: "File", name: "a", path: "root/a", language: "", description: "", signature: "" },
      { id: "sub", type: "Directory", name: "sub", path: "root/sub", language: "", description: "", signature: "" },
      { id: "b", type: "File", name: "b", path: "root/sub/b", language: "", description: "", signature: "" },
    ],
    edges: [
      { source: "root", target: "a", relationship: "contains" },
      { source: "root", target: "sub", relationship: "contains" },
      { source: "sub", target: "b", relationship: "contains" },
    ],
  };
  const noChanges = diffBlueprints(tree, tree);
  const noWarn = detectWarnings(tree);
  const fold = (collapsedDirs: Set<string>) =>
    toFlow(tree, {
      changes: noChanges,
      warnings: noWarn,
      search: "",
      selectedId: null,
      hiddenTypes: new Set<NodeType>(),
      collapsedDirs,
    });

  it("flags directories that own a contains subtree as collapsible", () => {
    const { nodes } = fold(new Set());
    expect(nodes.find((n) => n.id === "root")!.data.collapsible).toBe(true);
    expect(nodes.find((n) => n.id === "a")!.data.collapsible).toBe(false);
  });

  it("hides the entire subtree when a directory is collapsed", () => {
    const { nodes } = fold(new Set(["root"]));
    expect(nodes.map((n) => n.id)).toEqual(["root"]);
    expect(nodes[0].data.collapsed).toBe(true);
    expect(nodes[0].data.hiddenCount).toBe(3);
  });

  it("collapses only the targeted subtree", () => {
    const { nodes } = fold(new Set(["sub"]));
    expect(nodes.map((n) => n.id).sort()).toEqual(["a", "root", "sub"]);
    expect(nodes.find((n) => n.id === "sub")!.data.hiddenCount).toBe(1);
  });

  it("folds to the root when every directory is collapsed (collapse-all)", () => {
    // Both root and its nested dir are collapsed; the nested one must not leak
    // through as visible — a collapsed ancestor hides it.
    const { nodes } = fold(new Set(["root", "sub"]));
    expect(nodes.map((n) => n.id)).toEqual(["root"]);
    expect(nodes[0].data.hiddenCount).toBe(3);
  });
});
