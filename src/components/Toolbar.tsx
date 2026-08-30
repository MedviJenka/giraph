import { useEffect, useRef, type CSSProperties } from "react";

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
  padding: "10px 16px",
};

const titleStyle: CSSProperties = {
  fontWeight: 700,
  fontSize: 16,
  letterSpacing: 0.2,
  whiteSpace: "nowrap",
};

const summaryStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
};

/** True when focus sits in a field that should own the keystroke itself. */
function isTypingTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    node.isContentEditable
  );
}

export function Toolbar(props: ToolbarProps) {
  const { projectName, search, onSearch, mode, onMode, changeCount, warningCount } = props;
  const inputRef = useRef<HTMLInputElement>(null);

  // Press "/" anywhere (outside a text field) to jump into the search box.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTypingTarget(e.target)) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="toolbar" style={barStyle}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
        <LogoMark />
        <span style={titleStyle} className="rainbow-text">
          {projectName}
        </span>
      </span>

      <div className="search-field">
        <SearchIcon />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              if (search) onSearch("");
              else inputRef.current?.blur();
            }
          }}
          placeholder="Search components…"
          data-testid="search-input"
          aria-label="Search components"
        />
        <span className="kbd" aria-hidden="true">
          /
        </span>
      </div>

      <div className="seg-group" role="group" aria-label="Snapshot">
        <button
          type="button"
          className="seg-btn"
          data-testid="mode-current"
          aria-pressed={mode === "current"}
          onClick={() => onMode("current")}
        >
          Current
        </button>
        <button
          type="button"
          className="seg-btn"
          data-testid="mode-previous"
          aria-pressed={mode === "previous"}
          onClick={() => onMode("previous")}
        >
          Before
        </button>
      </div>

      <span style={summaryStyle} data-testid="summary">
        <span className="pill pill-changes">{changeCount} changes</span>
        {warningCount > 0 && (
          <span className="pill pill-warn">⚠ {warningCount}</span>
        )}
      </span>
    </div>
  );
}

function LogoMark() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="url(#logo-grad)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0%" stopColor="#f43f5e" />
          <stop offset="50%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
      </defs>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <path d="M7.7 7.6 10.6 15.8" />
      <path d="M16.3 7.6 13.4 15.8" />
      <path d="M8.5 6 15.5 6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}
