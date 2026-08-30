import { describe, it, expect } from "vitest";
import { current, previous } from "../data/blueprint";
import { detectWarnings, warnedNodeIds } from "./rules";

describe("detectWarnings", () => {
  it("raises exactly one layer violation for the current snapshot", () => {
    const warnings = detectWarnings(current);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].rule).toBe("layer_violation");
    expect(warnings[0].nodeIds).toEqual(["authRouter", "userRepository"]);
  });

  it("also flags the violation in the previous snapshot (edge predates TokenService)", () => {
    expect(detectWarnings(previous)).toHaveLength(1);
  });

  it("collects implicated node ids", () => {
    const ids = warnedNodeIds(detectWarnings(current));
    expect(ids.has("authRouter")).toBe(true);
    expect(ids.has("userRepository")).toBe(true);
    expect(ids.has("userService")).toBe(false);
  });
});
