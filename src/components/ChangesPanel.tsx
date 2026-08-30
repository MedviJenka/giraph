import type { ChangeSet, ChangeKind, BlueprintNode, ArchitectureWarning } from "../types";
import { changeSymbol } from "../lib/diff";

export interface ChangesPanelProps {
  changes: ChangeSet;
  warnings: ArchitectureWarning[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const changeColor: Record<ChangeKind, string> = {
  added: "#16a34a",
  modified: "#d97706",
  removed: "#dc2626",
  unchanged: "#475569",
};

const WARNING_COLOR = "#dc2626";

interface ChangeSection {
  title: string;
  kind: ChangeKind;
  nodes: BlueprintNode[];
}

export function ChangesPanel(props: ChangesPanelProps) {
  const { changes, warnings, selectedId, onSelect } = props;

  const sections: ChangeSection[] = [
    { title: "Added", kind: "added", nodes: changes.added },
    { title: "Modified", kind: "modified", nodes: changes.modified },
    { title: "Removed", kind: "removed", nodes: changes.removed },
  ];

  return (
    <div style={{ padding: 12, overflowY: "auto", height: "100%", boxSizing: "border-box" }}>
      <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>Latest Agent Changes</h2>

      {sections.map((section) => {
        if (section.nodes.length === 0) return null;
        return (
          <section key={section.kind} style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 12, textTransform: "uppercase", color: "#64748b", margin: "0 0 6px" }}>
              {section.title}
            </h3>
            {section.nodes.map((node) => {
              const selected = node.id === selectedId;
              return (
                <button
                  key={node.id}
                  data-testid="change-item"
                  data-change={section.kind}
                  data-node-id={node.id}
                  onClick={() => onSelect(node.id)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 8px",
                    marginBottom: 4,
                    border: "1px solid",
                    borderColor: selected ? changeColor[section.kind] : "#334155",
                    borderRadius: 6,
                    background: selected ? "#0f172a" : "transparent",
                    color: changeColor[section.kind],
                    fontWeight: selected ? 600 : 400,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontFamily: "monospace", marginRight: 6 }}>
                    {changeSymbol[section.kind]}
                  </span>
                  {node.name}
                </button>
              );
            })}
          </section>
        );
      })}

      <section style={{ marginBottom: 8 }}>
        <h3 style={{ fontSize: 12, textTransform: "uppercase", color: "#64748b", margin: "0 0 6px" }}>
          Warnings
        </h3>
        {warnings.length === 0 ? (
          <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>No architecture warnings.</p>
        ) : (
          warnings.map((w) => (
            <button
              key={w.id}
              data-testid="warning-item"
              onClick={() => onSelect(w.nodeIds[0])}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "6px 8px",
                marginBottom: 4,
                border: `1px solid ${WARNING_COLOR}`,
                borderRadius: 6,
                background: "transparent",
                color: WARNING_COLOR,
                cursor: "pointer",
              }}
            >
              ⚠ {w.message}
            </button>
          ))
        )}
      </section>
    </div>
  );
}
