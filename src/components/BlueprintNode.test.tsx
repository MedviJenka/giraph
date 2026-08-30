import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Position, ReactFlowProvider, type NodeProps } from "reactflow";
import { BlueprintNode } from "./BlueprintNode";
import type { BlueprintNodeData } from "../lib/layout";
import type { ChangeKind } from "../types";

function nodeProps(data: BlueprintNodeData): NodeProps<BlueprintNodeData> {
  return {
    id: data.blueprint.id,
    data,
    type: "blueprintNode",
    selected: false,
    isConnectable: true,
    xPos: 0,
    yPos: 0,
    zIndex: 0,
    dragging: false,
    targetPosition: Position.Top,
    sourcePosition: Position.Bottom,
  };
}

function data(change: ChangeKind, warned: boolean): BlueprintNodeData {
  return {
    blueprint: {
      id: "tokenService",
      type: "Service",
      name: "TokenService",
      path: "src/services/token_service.py",
      language: "python",
      description: "Issues tokens.",
      signature: "tokenService@1",
    },
    change,
    warned,
    focused: false,
    dimmed: false,
  };
}

function renderNode(d: BlueprintNodeData) {
  // Handle reads the React Flow store, so the node must render inside a provider.
  render(
    <ReactFlowProvider>
      <BlueprintNode {...nodeProps(d)} />
    </ReactFlowProvider>,
  );
}

describe("BlueprintNode", () => {
  it("renders the component name and type with change metadata", () => {
    renderNode(data("added", false));
    const el = screen.getByTestId("bp-node");
    expect(el).toHaveAttribute("data-node-id", "tokenService");
    expect(el).toHaveAttribute("data-change", "added");
    expect(el).toHaveTextContent("TokenService");
    expect(el).toHaveTextContent("Service");
    expect(el).toHaveTextContent("+");
  });

  it("shows a warning glyph only when warned", () => {
    renderNode(data("modified", true));
    expect(screen.getByTitle("architecture warning")).toBeInTheDocument();
    expect(screen.getByTestId("bp-node")).toHaveAttribute("data-warned", "true");
  });

  it("omits the change badge for unchanged nodes", () => {
    renderNode(data("unchanged", false));
    const el = screen.getByTestId("bp-node");
    expect(el).toHaveAttribute("data-change", "unchanged");
    expect(el).not.toHaveTextContent("~");
  });
});
