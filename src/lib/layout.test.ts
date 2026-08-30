import { describe, it, expect } from "vitest";
import { current } from "../data/blueprint";
import { diffBlueprints } from "./diff";
import { detectWarnings } from "./rules";
import { toFlow } from "./layout";

const changes = diffBlueprints(current, current); // no changes: exercise unchanged path
const warnings = detectWarnings(current);

function base(search = "", selectedId: string | null = null) {
  return toFlow(current, { changes, warnings, search, selectedId });
}

describe("toFlow", () => {
  it("maps every blueprint node and edge", () => {
    const { nodes, edges } = base();
    expect(nodes).toHaveLength(current.nodes.length);
    expect(edges).toHaveLength(current.edges.length);
  });

  it("places the root API node at layer 0 and descendants below", () => {
    const { nodes } = base();
    const api = nodes.find((n) => n.id === "api")!;
    const model = nodes.find((n) => n.id === "userModel")!;
    expect(api.position.y).toBe(0);
    expect(model.position.y).toBeGreaterThan(api.position.y);
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
