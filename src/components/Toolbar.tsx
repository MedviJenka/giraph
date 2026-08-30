import type { CSSProperties } from "react";

export interface ToolbarProps {
  projectName: string;
  search: string;
  onSearch: (v: string) => void;
  mode: "current" | "previous";
  onMode: (m: "current" | "previous") => void;
  changeCount: number;
  warningCount: number;
}

const barStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  padding: "8px 16px",
  borderBottom: "1px solid #1e293b",
  background: "#0f172a",
};

const titleStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: 16,
  color: "#f1f5f9",
  marginRight: 8,
};

const searchStyle: CSSProperties = {
  flex: 1,
  minWidth: 160,
  maxWidth: 320,
  padding: "6px 10px",
  border: "1px solid #334155",
  borderRadius: 6,
  fontSize: 14,
  background: "#1e293b",
  color: "#e2e8f0",
};

const toggleGroupStyle: CSSProperties = {
  display: "inline-flex",
  border: "1px solid #334155",
  borderRadius: 6,
  overflow: "hidden",
};

const summaryStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 12,
  fontSize: 13,
  color: "#94a3b8",
};

function toggleButtonStyle(active: boolean): CSSProperties {
  return {
    padding: "6px 14px",
    border: "none",
    background: active ? "#2563eb" : "transparent",
    color: active ? "#ffffff" : "#94a3b8",
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
  };
}

export function Toolbar(props: ToolbarProps) {
  const { projectName, search, onSearch, mode, onMode, changeCount, warningCount } = props;

  return (
    <div style={barStyle}>
      <span style={titleStyle} className="rainbow-text">{projectName}</span>

      <input
        type="text"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search components…"
        data-testid="search-input"
        style={searchStyle}
      />

      <div style={toggleGroupStyle}>
        <button
          type="button"
          data-testid="mode-current"
          aria-pressed={mode === "current"}
          onClick={() => onMode("current")}
          style={toggleButtonStyle(mode === "current")}
        >
          Current
        </button>
        <button
          type="button"
          data-testid="mode-previous"
          aria-pressed={mode === "previous"}
          onClick={() => onMode("previous")}
          style={toggleButtonStyle(mode === "previous")}
        >
          Before
        </button>
      </div>

      <span style={summaryStyle} data-testid="summary">
        <span>{changeCount} changes</span>
        {warningCount > 0 && <span style={{ color: "#dc2626" }}>⚠ {warningCount}</span>}
      </span>
    </div>
  );
}
