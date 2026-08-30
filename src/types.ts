// Blueprint domain model — mirrors PLAN.md §3 (Core Concept) and §6 (Dependency Graph).
// This is the shared contract consumed by the layout, diff, rules, and all components.

export type NodeType =
  | "Repository"
  | "Directory"
  | "File"
  | "Module"
  | "Class"
  | "Function"
  | "API Endpoint"
  | "Service"
  | "Repository Layer"
  | "Database Model"
  | "Agent"
  | "External Dependency";

export type Relationship =
  | "imports"
  | "calls"
  | "inherits"
  | "implements"
  | "depends_on"
  | "creates"
  | "reads"
  | "writes"
  | "exposes";

export interface BlueprintNode {
  id: string;
  type: NodeType;
  name: string;
  path: string;
  language: string;
  description: string;
  /** Content signature; a change between snapshots marks the node "modified". */
  signature: string;
  metadata?: Record<string, unknown>;
}

export interface BlueprintEdge {
  source: string;
  target: string;
  relationship: Relationship;
  metadata?: Record<string, unknown>;
}

export interface Blueprint {
  nodes: BlueprintNode[];
  edges: BlueprintEdge[];
}

/** Result of comparing two blueprint snapshots (PLAN.md §9 Agent Change Tracking). */
export interface ChangeSet {
  added: BlueprintNode[];
  removed: BlueprintNode[];
  /** Nodes present in both snapshots whose signature changed. */
  modified: BlueprintNode[];
}

export type ChangeKind = "added" | "removed" | "modified" | "unchanged";

/** Architecture rule violation (PLAN.md §Phase 6 rules.yaml). */
export interface ArchitectureWarning {
  id: string;
  rule: string;
  message: string;
  /** Node ids implicated by the violation. */
  nodeIds: string[];
}
