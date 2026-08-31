import { useCallback, useEffect, useMemo, useState } from "react";
import { current, previous } from "./data/blueprint";
import { fetchSnapshot, subscribeSnapshot, type Snapshot } from "./lib/source";
import { diffBlueprints, changeCount } from "./lib/diff";
import { detectWarnings } from "./lib/rules";
import { Toolbar } from "./components/Toolbar";
import { BlueprintCanvas } from "./components/BlueprintCanvas";
import { ChangesPanel } from "./components/ChangesPanel";
import { ExplainPanel } from "./components/ExplainPanel";
import type { NodeType } from "./types";

export function App() {
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"current" | "previous">("current");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<Set<NodeType>>(new Set());
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());
  // Initialize from the bundled sample so the UI is never empty, then overwrite
  // from the live server via fetch + SSE.
  const [snapshot, setSnapshot] = useState<Snapshot>({ previous, current });

  useEffect(() => {
    let active = true;
    const apply = (s: Snapshot) => {
      if (active) setSnapshot(s);
    };
    fetchSnapshot().then(apply);
    const off = subscribeSnapshot(apply);
    return () => {
      active = false;
      off();
    };
  }, []);

  // The change set is always the previous -> current transition, independent of which
  // snapshot is being viewed (PLAN.md §9). Warnings are evaluated on the visible snapshot.
  const changes = useMemo(
    () => diffBlueprints(snapshot.previous, snapshot.current),
    [snapshot],
  );
  const blueprint = mode === "current" ? snapshot.current : snapshot.previous;
  const warnings = useMemo(() => detectWarnings(blueprint), [blueprint]);
  const selectedNode = blueprint.nodes.find((n) => n.id === selectedId) ?? null;

  // Present types (with counts) for the category filter, and every directory
  // that owns a `contains` subtree (collapse-all targets).
  const typeCounts = useMemo(() => {
    const counts = new Map<NodeType, number>();
    for (const n of blueprint.nodes) counts.set(n.type, (counts.get(n.type) ?? 0) + 1);
    return [...counts.entries()].map(([type, count]) => ({ type, count }));
  }, [blueprint]);

  const collapsibleDirIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of blueprint.edges) if (e.relationship === "contains") ids.add(e.source);
    return ids;
  }, [blueprint]);

  const toggleType = useCallback((type: NodeType) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const collapseAll = useCallback(
    () => setCollapsedDirs(new Set(collapsibleDirIds)),
    [collapsibleDirIds],
  );
  const expandAll = useCallback(() => setCollapsedDirs(new Set<string>()), []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Toolbar
        projectName="Project Blueprint"
        search={search}
        onSearch={setSearch}
        mode={mode}
        onMode={setMode}
        changeCount={changeCount(changes)}
        warningCount={warnings.length}
        types={typeCounts}
        hiddenTypes={hiddenTypes}
        onToggleType={toggleType}
        collapsedCount={collapsedDirs.size}
        onCollapseAll={collapseAll}
        onExpandAll={expandAll}
      />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <BlueprintCanvas
            blueprint={blueprint}
            changes={changes}
            warnings={warnings}
            search={search}
            selectedId={selectedId}
            onSelect={setSelectedId}
            hiddenTypes={hiddenTypes}
            collapsedDirs={collapsedDirs}
            onToggleCollapse={toggleCollapse}
          />
        </div>
        <aside
          style={{
            width: 340,
            borderLeft: "1px solid #1e293b",
            background: "#0f172a",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <ExplainPanel node={selectedNode} blueprint={blueprint} />
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            <ChangesPanel
              changes={changes}
              warnings={warnings}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
