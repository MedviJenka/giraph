import { describe, it, expect } from "vitest";
import { current, previous } from "../data/blueprint";
import { diffBlueprints, nodeChangeKind, changeCount } from "./diff";

describe("diffBlueprints", () => {
  const changes = diffBlueprints(previous, current);

  it("detects the agent-added TokenService node", () => {
    expect(changes.added.map((n) => n.id)).toEqual(["tokenService"]);
  });

  it("flags rewired nodes as modified via signature change", () => {
    expect(changes.modified.map((n) => n.id).sort()).toEqual([
      "authRouter",
      "authService",
    ]);
  });

  it("reports no removals for this changeset", () => {
    expect(changes.removed).toHaveLength(0);
  });

  it("counts every changed node", () => {
    expect(changeCount(changes)).toBe(3);
  });

  it("classifies a node against the changeset", () => {
    expect(nodeChangeKind("tokenService", changes)).toBe("added");
    expect(nodeChangeKind("authService", changes)).toBe("modified");
    expect(nodeChangeKind("userModel", changes)).toBe("unchanged");
  });
});
