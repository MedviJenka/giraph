import { useCallback, useEffect, useMemo, useRef } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type XYPosition,
} from "reactflow";
import type { Blueprint, ChangeSet, ArchitectureWarning } from "../types";
import { toFlow, type BlueprintNodeData } from "../lib/layout";
import { BlueprintNode } from "./BlueprintNode";

const nodeTypes = { blueprintNode: BlueprintNode };

export interface BlueprintCanvasProps {
  blueprint: Blueprint;
  changes: ChangeSet;
  warnings: ArchitectureWarning[];
  search: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function BlueprintCanvas(props: BlueprintCanvasProps) {
  const { blueprint, changes, warnings, search, selectedId, onSelect } = props;

  const layout = useMemo(
    () => toFlow(blueprint, { changes, warnings, search, selectedId }),
    [blueprint, changes, warnings, search, selectedId],
  );

  // Positions the user has dragged, keyed by node id. Survives re-layout so selecting or
  // searching never snaps a hand-placed card back to its computed slot.
  const draggedPositions = useRef<Map<string, XYPosition>>(new Map());

  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layout.edges);

  // Re-apply computed data/styling on every layout change while keeping dragged positions.
  useEffect(() => {
    setNodes(
      layout.nodes.map((n) => {
        const pinned = draggedPositions.current.get(n.id);
        return pinned ? { ...n, position: pinned } : n;
      }),
    );
  }, [layout, setNodes]);

  useEffect(() => {
    setEdges(layout.edges);
  }, [layout, setEdges]);

  const onNodeDragStop = useCallback((_: unknown, node: Node<BlueprintNodeData>) => {
    draggedPositions.current.set(node.id, node.position);
  }, []);

  return (
    <div data-testid="blueprint-canvas" style={{ width: "100%", height: "100%" }}>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
        <defs>
          {(
            [
              ["edge-dot", "#94a3b8"],
              ["edge-dot-active", "#2563eb"],
              ["edge-dot-violation", "#dc2626"],
            ] as const
          ).map(([id, color]) => (
            <marker
              key={id}
              id={id}
              markerWidth={7}
              markerHeight={7}
              refX={3.5}
              refY={3.5}
              markerUnits="userSpaceOnUse"
            >
              <circle cx={3.5} cy={3.5} r={3} fill={color} />
            </marker>
          ))}
        </defs>
      </svg>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onNodeClick={(_, n) => onSelect(n.id)}
        onPaneClick={() => onSelect(null)}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
        <Controls />
        <MiniMap
          nodeColor="#334155"
          nodeStrokeColor="#0b1120"
          maskColor="rgba(11,17,32,0.7)"
          style={{ background: "#0f172a" }}
        />
      </ReactFlow>
    </div>
  );
}
