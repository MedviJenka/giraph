import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ignore from "ignore";
import type {
  Blueprint,
  BlueprintEdge,
  BlueprintNode,
  NodeType,
} from "../src/types";

/** Directories/files always skipped regardless of .gitignore. */
const ALWAYS_IGNORE: Record<string, true> = {
  ".git": true,
  "node_modules": true,
  "dist": true,
  "dist-server": true,
  ".blueprint": true,
};

/** Extensions whose files may declare resolvable imports. */
const IMPORT_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py"];

/** Candidate extensions tried when resolving an extensionless relative import. */
const RESOLVE_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py"];

/**
 * Matches quoted module specifiers in ES import/export/require/dynamic-import
 * forms. Only the quoted specifier (group 1) is captured.
 */
const IMPORT_RE =
  /(?:import\b[^'"]*from\s*|export\b[^'"]*from\s*|import\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;

function languageFor(ext: string): string {
  switch (ext) {
    case ".ts":
    case ".tsx":
      return "TypeScript";
    case ".js":
    case ".jsx":
    case ".mjs":
    case ".cjs":
      return "JavaScript";
    case ".py":
      return "Python";
    case ".json":
      return "JSON";
    case ".md":
      return "Markdown";
    case ".css":
      return "CSS";
    case ".html":
      return "HTML";
    default:
      return "";
  }
}

/**
 * Physical→logical classification, best-effort and case-insensitive on path
 * segments. Order encodes precedence (endpoint → service → repo → model).
 */
function classifyFile(id: string, name: string, ext: string): NodeType {
  const segs = id.toLowerCase().split("/");
  const fname = name.toLowerCase();
  const hasSeg = (...words: string[]) => segs.some((s) => words.includes(s));

  if (
    hasSeg("route", "routes", "router", "controller", "controllers", "api", "endpoints") ||
    fname.includes("router") ||
    fname.includes("controller")
  ) {
    return "API Endpoint";
  }
  if (hasSeg("service", "services") || fname.includes("service")) {
    return "Service";
  }
  if (
    hasSeg("repository", "repositories", "repo", "repos", "dao") ||
    fname.includes("repository")
  ) {
    return "Repository Layer";
  }
  if (
    hasSeg("model", "models", "entity", "entities", "schema", "schemas") ||
    fname.includes("model")
  ) {
    return "Database Model";
  }
  return IMPORT_EXTS.includes(ext) ? "Module" : "File";
}

function describeFile(type: NodeType, language: string, lines: number): string {
  switch (type) {
    case "API Endpoint":
      return "API endpoint";
    case "Service":
      return "Service module";
    case "Repository Layer":
      return "Repository layer";
    case "Database Model":
      return "Database model";
    default: {
      const label = language || "Text";
      return `${label} file · ${lines} lines`;
    }
  }
}

interface SourceFile {
  id: string;
  content: string;
}

/**
 * Scan a project tree into a deterministic Blueprint. Synchronous by contract
 * so callers (baseline capture, watcher rescans) can diff serialized output.
 */
export function scanProject(root: string): Blueprint {
  const absRoot = path.resolve(root);
  const ig = ignore();
  const gitignorePath = path.join(absRoot, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    ig.add(fs.readFileSync(gitignorePath, "utf8"));
  }

  const nodes: BlueprintNode[] = [];
  const edges: BlueprintEdge[] = [];
  const nodeIds = new Set<string>();
  const sources: SourceFile[] = [];

  // Root repository node.
  nodes.push({
    id: ".",
    type: "Repository",
    name: path.basename(absRoot),
    path: ".",
    language: "",
    description: "Repository root",
    signature: "dir",
  });
  nodeIds.add(".");

  function shouldIgnore(relPosix: string, name: string, isDir: boolean): boolean {
    if (ALWAYS_IGNORE[name] === true) return true;
    if (isDir && name.startsWith(".")) return true; // e.g. .vite
    // gitignore directory rules (e.g. `secret/`) only match with a trailing slash.
    return ig.ignores(isDir ? `${relPosix}/` : relPosix);
  }

  function addFileNode(abs: string, id: string, name: string): void {
    const stat = fs.statSync(abs);
    const ext = path.extname(name).toLowerCase();
    const language = languageFor(ext);
    let content = "";
    try {
      content = fs.readFileSync(abs, "utf8");
    } catch {
      content = "";
    }
    const lines = content.length === 0 ? 0 : content.split("\n").length;
    const type = classifyFile(id, name, ext);
    nodes.push({
      id,
      type,
      name,
      path: id,
      language,
      description: describeFile(type, language, lines),
      signature: createHash("sha1")
        .update(`${stat.size}:${stat.mtimeMs}`)
        .digest("hex")
        .slice(0, 12),
      metadata: { bytes: stat.size, lines },
    });
    nodeIds.add(id);
    if (IMPORT_EXTS.includes(ext)) sources.push({ id, content });
  }

  // Recursively walk a directory; returns the ids of its direct children.
  function walk(absDir: string, relDir: string): string[] {
    const childIds: string[] = [];
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    for (const entry of entries) {
      const name = entry.name;
      const isDir = entry.isDirectory();
      if (!isDir && !entry.isFile()) continue; // skip symlinks/special
      const relPosix = relDir === "." ? name : `${relDir}/${name}`;
      if (shouldIgnore(relPosix, name, isDir)) continue;
      const abs = path.join(absDir, name);
      if (isDir) {
        childIds.push(relPosix);
        const grandChildren = walk(abs, relPosix);
        nodes.push({
          id: relPosix,
          type: "Directory",
          name,
          path: relPosix,
          language: "",
          description: `Directory · ${grandChildren.length} items`,
          signature: "dir",
        });
        nodeIds.add(relPosix);
        for (const cid of grandChildren) {
          edges.push({ source: relPosix, target: cid, relationship: "contains" });
        }
      } else {
        childIds.push(relPosix);
        addFileNode(abs, relPosix, name);
      }
    }
    return childIds;
  }

  const rootChildren = walk(absRoot, ".");
  for (const cid of rootChildren) {
    edges.push({ source: ".", target: cid, relationship: "contains" });
  }

  // Resolve relative imports to existing file nodes.
  for (const src of sources) {
    const baseDir = path.posix.dirname(src.id);
    const seen = new Set<string>();
    let match: RegExpExecArray | null;
    IMPORT_RE.lastIndex = 0;
    while ((match = IMPORT_RE.exec(src.content)) !== null) {
      const spec = match[1];
      if (!spec.startsWith("./") && !spec.startsWith("../")) continue;
      const target = resolveImport(baseDir, spec, nodeIds);
      if (!target || target === src.id || seen.has(target)) continue;
      seen.add(target);
      edges.push({ source: src.id, target, relationship: "imports" });
    }
  }

  nodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  edges.sort((a, b) => {
    if (a.source !== b.source) return a.source < b.source ? -1 : 1;
    if (a.target !== b.target) return a.target < b.target ? -1 : 1;
    return a.relationship < b.relationship ? -1 : a.relationship > b.relationship ? 1 : 0;
  });

  return { nodes, edges };
}

function resolveImport(
  baseDir: string,
  spec: string,
  nodeIds: Set<string>,
): string | null {
  const target = path.posix.normalize(path.posix.join(baseDir, spec));
  if (target === "." || target.startsWith("..")) return null;
  if (nodeIds.has(target)) return target;
  for (const ext of RESOLVE_EXTS) {
    if (nodeIds.has(target + ext)) return target + ext;
  }
  for (const ext of RESOLVE_EXTS) {
    const indexId = `${target}/index${ext}`;
    if (nodeIds.has(indexId)) return indexId;
  }
  return null;
}
