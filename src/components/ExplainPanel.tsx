import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { Blueprint, BlueprintNode } from "../types";
import { explainComponent } from "../lib/explain";

const KEY_STORAGE = "bp.llm.apiKey";
const MODEL_STORAGE = "bp.llm.model";
const DEFAULT_MODEL = "gpt-4o-mini";

export interface ExplainPanelProps {
  node: BlueprintNode | null;
  blueprint: Blueprint;
}

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

export function ExplainPanel(props: ExplainPanelProps) {
  const { node, blueprint } = props;

  const [apiKey, setApiKey] = useState(() => localStorage.getItem(KEY_STORAGE) ?? "");
  const [model, setModel] = useState(() => localStorage.getItem(MODEL_STORAGE) ?? DEFAULT_MODEL);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // A new selection invalidates any prior explanation and cancels an in-flight request.
  useEffect(() => {
    abortRef.current?.abort();
    setResult("");
    setError("");
    setLoading(false);
  }, [node?.id]);

  useEffect(() => localStorage.setItem(KEY_STORAGE, apiKey), [apiKey]);
  useEffect(() => localStorage.setItem(MODEL_STORAGE, model), [model]);

  const explain = useCallback(async () => {
    if (!node) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError("");
    setResult("");
    try {
      const text = await explainComponent(node, blueprint, {
        apiKey: apiKey.trim(),
        model: model.trim() || DEFAULT_MODEL,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) setResult(text);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [node, blueprint, apiKey, model]);

  if (!node) {
    return (
      <section data-testid="explain-panel" style={{ padding: 12, borderBottom: "1px solid #1e293b" }}>
        <h2 style={{ fontSize: 16, margin: "0 0 6px", color: "#f1f5f9" }}>Explain with AI</h2>
        <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>
          Select a component to generate an AI explanation of its role.
        </p>
      </section>
    );
  }

  const canExplain = apiKey.trim().length > 0 && !loading;

  return (
    <section data-testid="explain-panel" style={{ padding: 12, borderBottom: "1px solid #1e293b" }}>
      <h2 style={{ fontSize: 16, margin: "0 0 2px", color: "#f1f5f9" }}>Explain with AI</h2>
      <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 10px" }}>
        {node.name} <span style={{ color: "#64748b" }}>· {node.type}</span>
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

      <button
        type="button"
        data-testid="explain-button"
        onClick={explain}
        disabled={!canExplain}
        className={canExplain ? "rainbow-border" : undefined}
        style={{
          padding: "7px 14px",
          border: "none",
          borderRadius: 8,
          background: canExplain ? undefined : "#334155",
          color: canExplain ? "#ffffff" : "#94a3b8",
          fontSize: 14,
          fontWeight: 600,
          cursor: canExplain ? "pointer" : "not-allowed",
        }}
      >
        {loading ? "Explaining…" : "Explain with AI"}
      </button>

      {apiKey.trim().length === 0 && (
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
        <pre
          data-testid="explain-result"
          style={{
            marginTop: 10,
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
      )}
    </section>
  );
}
