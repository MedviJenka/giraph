import { describe, it, expect } from "vitest";
import type { Blueprint } from "../types";
import { buildArchitecturePrompt, buildExplainPrompt } from "./explain";

const blueprint: Blueprint = {
  nodes: [
    {
      id: "authService",
      type: "Service",
      name: "AuthService",
      path: "src/services/auth_service.py",
      language: "python",
      description: "Handles authentication.",
      signature: "authService@1",
    },
    {
      id: "authRouter",
      type: "API Endpoint",
      name: "AuthRouter",
      path: "src/api/auth_router.py",
      language: "python",
      description: "Routes auth requests.",
      signature: "authRouter@1",
    },
    {
      id: "userRepo",
      type: "Repository Layer",
      name: "UserRepository",
      path: "src/repo/user_repository.py",
      language: "python",
      description: "Reads and writes users.",
      signature: "userRepo@1",
    },
  ],
  edges: [
    { source: "authRouter", target: "authService", relationship: "calls" },
    { source: "authService", target: "userRepo", relationship: "depends_on" },
  ],
};

describe("buildExplainPrompt", () => {
  it("grounds the prompt in the node's identity and neighbor names", () => {
    const node = blueprint.nodes[0];
    const { system, user } = buildExplainPrompt(node, blueprint);

    expect(system).toMatch(/Purpose:/);
    expect(system).toMatch(/Responsibilities:/);
    expect(system).toMatch(/Dependencies:/);

    // Node identity is present.
    expect(user).toContain("Component: AuthService");
    expect(user).toContain("Type: Service");
    expect(user).toContain("src/services/auth_service.py");

    // Outgoing edge resolved to the target's display name, not its id.
    expect(user).toContain("depends_on UserRepository");
    // Incoming edge resolved to the source's display name.
    expect(user).toContain("AuthRouter calls this");
  });

  it("reports absence of relationships explicitly", () => {
    const isolated: Blueprint = { nodes: [blueprint.nodes[0]], edges: [] };
    const { user } = buildExplainPrompt(isolated.nodes[0], isolated);
    expect(user).toContain("Outgoing relationships: none");
    expect(user).toContain("Incoming relationships: none");
  });
});

describe("buildArchitecturePrompt", () => {
  it("summarizes the component inventory grouped by type and the resolved relationships", () => {
    const { system, user } = buildArchitecturePrompt(blueprint);

    expect(system).toMatch(/Overview:/);
    expect(system).toMatch(/Layers:/);
    expect(system).toMatch(/Data flow:/);

    expect(user).toContain("Components (3 total):");
    expect(user).toContain("- Service (1): AuthService");
    expect(user).toContain("- API Endpoint (1): AuthRouter");

    // Edges are resolved to display names, not ids.
    expect(user).toContain("- AuthRouter calls AuthService");
    expect(user).toContain("- AuthService depends_on UserRepository");
  });

  it("reports an empty blueprint explicitly", () => {
    const { user } = buildArchitecturePrompt({ nodes: [], edges: [] });
    expect(user).toContain("Components (0 total):");
    expect(user).toContain("Relationships: none");
  });
});
