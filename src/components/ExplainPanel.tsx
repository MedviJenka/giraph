import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { Blueprint, BlueprintNode } from "../types";
import { explainArchitecture, explainComponent } from "../lib/explain";

const KEY_STORAGE = "bp.llm.apiKey";
const MODEL_STORAGE = "bp.llm.model";
const DEFAULT_MODEL = "gpt-4o-mini";

export interface ExplainPanelProps {
  node: BlueprintNode | null;
  blueprint: Blueprint;
}

type ResultKind = "" | "component" | "architecture";

const fieldStyle: CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  border: "1px solid #334155",
  borderRadius: 6,
  fontSize: 13,
  background: "#1e293b",
  color: "#e2e8f0",
  boxSizing: "border-box",
};

const buttonStyle = (enabled: boolean): CSSProperties => ({
  flex: 1,
  padding: "7px 14px",
  border: "none",
  borderRadius: 8,
  background: enabled ? undefined : "#334155",
  color: enabled ? "#ffffff" : "#94a3b8",
  fontSize: 14,
  fontWeight: 600,
  cursor: enabled ? "pointer" : "not-allowed",
});

export function ExplainPanel(props: ExplainPanelProps) {
  const { node, blueprint } = props;

  const [apiKey, setApiKey] = useState(() => localStorage.getItem(KEY_STORAGE) ?? "");
  const [model, setModel] = useState(() => localStorage.getItem(MODEL_STORAGE) ?? DEFAULT_MODEL);
  const [result, setResult] = useState("");
  const [subject, setSubject] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Mirror of the result's scope so the selection effect can decide what to keep
  // without re-running whenever the result changes.
  const kindRef = useRef<ResultKind>("");

  // Selecting a different node cancels any in-flight request and invalidates a
  // component-scoped explanation. An architecture explanation stays valid.
  useEffect(() => {
    abortRef.current?.abort();
    setError("");
    setLoading(false);
    if (kindRef.current === "component") {
      setResult("");
      setSubject("");
      kindRef.current = "";
    }
  }, [node?.id]);

  useEffect(() => localStorage.setItem(KEY_STORAGE, apiKey), [apiKey]);
  useEffect(() => localStorage.setItem(MODEL_STORAGE, model), [model]);

  const run = useCallback(
    async (kind: "component" | "architecture") => {
      if (kind === "component" && !node) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError("");
      setResult("");
      setSubject("");
      const opts = {
        apiKey: apiKey.trim(),
        model: model.trim() || DEFAULT_MODEL,
        signal: controller.signal,
      };
      try {
        const text =
          kind === "component"
            ? await explainComponent(node!, blueprint, opts)
            : await explainArchitecture(blueprint, opts);
        if (!controller.signal.aborted) {
          setResult(text);
          setSubject(kind === "component" ? node!.name : "Whole architecture");
          kindRef.current = kind;
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [node, blueprint, apiKey, model],
  );

  const hasKey = apiKey.trim().length > 0;
  const canArchitecture = hasKey && !loading;
  const canComponent = hasKey && !loading && !!node;

  return (
    <section data-testid="explain-panel" style={{ padding: 12, borderBottom: "1px solid #1e293b" }}>
      <h2 style={{ fontSize: 16, margin: "0 0 2px", color: "#f1f5f9" }}>Explain with AI</h2>
      <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 10px" }}>
        {node ? (
          <>
            {node.name} <span style={{ color: "#64748b" }}>· {node.type}</span>
          </>
        ) : (
          "Explain the whole architecture, or select a component."
        )}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        <input
          type="password"
          data-testid="api-key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="OpenAI-compatible API key"
          style={fieldStyle}
        />
        <input
          type="text"
          data-testid="model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="Model (e.g. gpt-4o-mini)"
          style={fieldStyle}
        />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          data-testid="explain-architecture-button"
          onClick={() => run("architecture")}
          disabled={!canArchitecture}
          className={canArchitecture ? "rainbow-border" : undefined}
          style={buttonStyle(canArchitecture)}
        >
          {loading ? "Explaining…" : "Explain architecture"}
        </button>
        <button
          type="button"
          data-testid="explain-button"
          onClick={() => run("component")}
          disabled={!canComponent}
          className={canComponent ? "rainbow-border" : undefined}
          style={buttonStyle(canComponent)}
        >
          Explain component
        </button>
      </div>

      {!hasKey && (
        <p style={{ color: "#94a3b8", fontSize: 12, margin: "8px 0 0" }}>
          Add an API key to enable explanations. It is stored only in this browser.
        </p>
      )}

      {error && (
        <p data-testid="explain-error" style={{ color: "#f87171", fontSize: 13, margin: "10px 0 0" }}>
          {error}
        </p>
      )}

      {result && (
        <>
          {subject && (
            <p style={{ color: "#64748b", fontSize: 12, margin: "10px 0 0" }}>{subject}</p>
          )}
          <pre
            data-testid="explain-result"
            style={{
              marginTop: subject ? 4 : 10,
              padding: 10,
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 8,
              color: "#e2e8f0",
              fontSize: 13,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "inherit",
            }}
          >
            {result}
          </pre>
        </>
      )}
    </section>
  );
}
