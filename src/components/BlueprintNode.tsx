import { Handle, Position, type NodeProps } from "reactflow";
import type { CSSProperties } from "react";
import type { ChangeKind } from "../types";
import type { BlueprintNodeData } from "../lib/layout";
import { changeSymbol } from "../lib/diff";

const changeColor: Record<ChangeKind, string> = {
  added: "#16a34a",
  modified: "#d97706",
  removed: "#dc2626",
  unchanged: "#64748b",
};

const WARNING_COLOR = "#dc2626";

export function BlueprintNode({ data }: NodeProps<BlueprintNodeData>) {
  const { blueprint, change, warned, focused, dimmed, collapsible, collapsed, hiddenCount, onToggleCollapse } =
    data;
  const accent = changeColor[change];
  const glow = change === "added" || focused;

  const cardStyle: CSSProperties = {
    position: "relative",
    minWidth: 160,
    padding: "10px 14px",
    borderRadius: 10,
    border: `2px solid ${accent}`,
    background: "#1e293b",
    boxShadow: glow ? undefined : "0 1px 4px rgba(0,0,0,0.5)",
    opacity: dimmed ? 0.35 : 1,
    color: "#f1f5f9",
    cursor: "grab",
  };

  return (
    <div
      style={cardStyle}
      className={glow ? "node-glow" : undefined}
      data-testid="bp-node"
      data-node-id={blueprint.id}
      data-change={change}
      data-warned={warned}
    >
      <Handle type="target" position={Position.Top} />

      {change !== "unchanged" && (
        <span
          style={{
            position: "absolute",
            top: 6,
            right: 8,
            fontWeight: 700,
            color: accent,
          }}
        >
          {changeSymbol[change]}
        </span>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontWeight: 700,
          paddingRight: 16,
        }}
      >
        {collapsible && (
          <button
            type="button"
            data-testid="collapse-toggle"
            aria-label={collapsed ? "Expand folder" : "Collapse folder"}
            aria-expanded={!collapsed}
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse?.(blueprint.id);
            }}
            style={{
              border: "none",
              background: "transparent",
              color: "#cbd5e1",
              cursor: "pointer",
              padding: 0,
              width: 14,
              fontSize: 12,
              lineHeight: 1,
            }}
          >
            {collapsed ? "▸" : "▾"}
          </button>
        )}
        <span>{blueprint.name}</span>
        {warned && (
          <span title="architecture warning" style={{ marginLeft: 2, color: WARNING_COLOR }}>
            ⚠
          </span>
        )}
        {collapsed && hiddenCount > 0 && (
          <span
            data-testid="collapsed-count"
            title={`${hiddenCount} nested items hidden`}
            style={{
              marginLeft: "auto",
              fontSize: 11,
              fontWeight: 600,
              color: "#93c5fd",
              background: "#1d283a",
              borderRadius: 999,
              padding: "1px 7px",
            }}
          >
            +{hiddenCount}
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8" }}>{blueprint.type}</div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
