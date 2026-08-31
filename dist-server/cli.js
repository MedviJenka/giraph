#!/usr/bin/env node

// server/cli.ts
import path3 from "node:path";

// server/server.ts
import http from "node:http";
import fs2 from "node:fs";
import path2 from "node:path";
import { fileURLToPath } from "node:url";
import chokidar from "chokidar";
import ignore2 from "ignore";

// server/scanner.ts
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ignore from "ignore";
var ALWAYS_IGNORE = {
  ".git": true,
  "node_modules": true,
  "dist": true,
  "dist-server": true,
  ".blueprint": true
};
var IMPORT_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py"];
var RESOLVE_EXTS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py"];
var IMPORT_RE = /(?:import\b[^'"]*from\s*|export\b[^'"]*from\s*|import\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;
function languageFor(ext) {
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
function classifyFile(id, name, ext) {
  const segs = id.toLowerCase().split("/");
  const fname = name.toLowerCase();
  const hasSeg = (...words) => segs.some((s) => words.includes(s));
  if (hasSeg("route", "routes", "router", "controller", "controllers", "api", "endpoints") || fname.includes("router") || fname.includes("controller")) {
    return "API Endpoint";
  }
  if (hasSeg("service", "services") || fname.includes("service")) {
    return "Service";
  }
  if (hasSeg("repository", "repositories", "repo", "repos", "dao") || fname.includes("repository")) {
    return "Repository Layer";
  }
  if (hasSeg("model", "models", "entity", "entities", "schema", "schemas") || fname.includes("model")) {
    return "Database Model";
  }
  return IMPORT_EXTS.includes(ext) ? "Module" : "File";
}
function describeFile(type, language, lines) {
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
      return `${label} file \xB7 ${lines} lines`;
    }
  }
}
function scanProject(root) {
  const absRoot = path.resolve(root);
  const ig = ignore();
  const gitignorePath = path.join(absRoot, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    ig.add(fs.readFileSync(gitignorePath, "utf8"));
  }
  const nodes = [];
  const edges = [];
  const nodeIds = /* @__PURE__ */ new Set();
  const sources = [];
  nodes.push({
    id: ".",
    type: "Repository",
    name: path.basename(absRoot),
    path: ".",
    language: "",
    description: "Repository root",
    signature: "dir"
  });
  nodeIds.add(".");
  function shouldIgnore(relPosix, name, isDir) {
    if (ALWAYS_IGNORE[name] === true) return true;
    if (isDir && name.startsWith(".")) return true;
    return ig.ignores(isDir ? `${relPosix}/` : relPosix);
  }
  function addFileNode(abs, id, name) {
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
      signature: createHash("sha1").update(`${stat.size}:${stat.mtimeMs}`).digest("hex").slice(0, 12),
      metadata: { bytes: stat.size, lines }
    });
    nodeIds.add(id);
    if (IMPORT_EXTS.includes(ext)) sources.push({ id, content });
  }
  function walk(absDir, relDir) {
    const childIds = [];
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    for (const entry of entries) {
      const name = entry.name;
      const isDir = entry.isDirectory();
      if (!isDir && !entry.isFile()) continue;
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
          description: `Directory \xB7 ${grandChildren.length} items`,
          signature: "dir"
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
  for (const src of sources) {
    const baseDir = path.posix.dirname(src.id);
    const seen = /* @__PURE__ */ new Set();
    let match;
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
  nodes.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  edges.sort((a, b) => {
    if (a.source !== b.source) return a.source < b.source ? -1 : 1;
    if (a.target !== b.target) return a.target < b.target ? -1 : 1;
    return a.relationship < b.relationship ? -1 : a.relationship > b.relationship ? 1 : 0;
  });
  return { nodes, edges };
}
function resolveImport(baseDir, spec, nodeIds) {
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

// server/server.ts
var DEFAULT_PORT = 4317;
var HEARTBEAT_MS = 25e3;
var DEBOUNCE_MS = 150;
var ALWAYS_IGNORED = {
  ".git": true,
  node_modules: true,
  dist: true,
  "dist-server": true,
  ".blueprint": true,
  ".vite": true
};
var MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8"
};
function createIgnoreMatcher(root) {
  const ig = ignore2();
  const gitignorePath = path2.join(root, ".gitignore");
  if (fs2.existsSync(gitignorePath)) {
    ig.add(fs2.readFileSync(gitignorePath, "utf8"));
  }
  return (absPath, stats) => {
    const rel = path2.relative(root, absPath).split(path2.sep).join("/");
    if (rel === "" || rel.startsWith("..")) return false;
    const segments = rel.split("/");
    if (segments.some((seg) => ALWAYS_IGNORED[seg])) return true;
    const base = segments[segments.length - 1];
    if (base.startsWith(".") && stats?.isDirectory()) return true;
    return ig.ignores(stats?.isDirectory() ? `${rel}/` : rel);
  };
}
function resolveDistDir() {
  const override = process.env.GIRAPH_DIST;
  if (override) return path2.resolve(override);
  const here = path2.dirname(fileURLToPath(import.meta.url));
  return path2.resolve(here, "..", "dist");
}
function listen(server, port) {
  const { promise, resolve, reject } = Promise.withResolvers();
  const onError = (err) => {
    if (err.code === "EADDRINUSE" && port !== 0) {
      server.removeListener("error", onError);
      server.listen(0, () => {
        const address = server.address();
        resolve(typeof address === "object" && address ? address.port : 0);
      });
      return;
    }
    reject(err);
  };
  server.once("error", onError);
  server.listen(port, () => {
    server.removeListener("error", onError);
    const address = server.address();
    resolve(typeof address === "object" && address ? address.port : port);
  });
  return promise;
}
async function startServer(opts) {
  const root = path2.resolve(opts.root);
  const distDir = resolveDistDir();
  const baseline = scanProject(root);
  let current = baseline;
  const clients = /* @__PURE__ */ new Set();
  const snapshotJson = () => JSON.stringify({ baseline, current });
  const sendSnapshot = (res) => {
    res.write(`event: blueprint
data: ${snapshotJson()}

`);
  };
  const broadcast = () => {
    const payload = `event: blueprint
data: ${snapshotJson()}

`;
    for (const res of clients) res.write(payload);
  };
  const serveStatic = (req, res) => {
    const indexPath = path2.join(distDir, "index.html");
    if (!fs2.existsSync(indexPath)) {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end(
        "giraph UI is not built yet. Run `npm run build` to generate the dist/ directory.\n"
      );
      return;
    }
    const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
    let filePath = path2.join(distDir, urlPath);
    if (!filePath.startsWith(distDir)) filePath = indexPath;
    fs2.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        serveFile(indexPath, res);
        return;
      }
      serveFile(filePath, res);
    });
  };
  const serveFile = (filePath, res) => {
    const type = MIME_TYPES[path2.extname(filePath).toLowerCase()] ?? "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    fs2.createReadStream(filePath).pipe(res);
  };
  const server = http.createServer((req, res) => {
    const url2 = (req.url ?? "/").split("?")[0];
    if (url2 === "/api/blueprint") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(snapshotJson());
      return;
    }
    if (url2 === "/api/events") {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive"
      });
      sendSnapshot(res);
      clients.add(res);
      req.on("close", () => {
        clients.delete(res);
      });
      return;
    }
    serveStatic(req, res);
  });
  const port = await listen(server, opts.port ?? DEFAULT_PORT);
  const url = `http://localhost:${port}`;
  const heartbeat = setInterval(() => {
    for (const res of clients) res.write(": ping\n\n");
  }, HEARTBEAT_MS);
  const isIgnored = createIgnoreMatcher(root);
  const watcher = chokidar.watch(root, {
    ignoreInitial: true,
    ignored: (p, stats) => isIgnored(p, stats)
  });
  let debounce = null;
  const scheduleRescan = () => {
    clearTimeout(debounce ?? void 0);
    debounce = setTimeout(() => {
      debounce = null;
      const next = scanProject(root);
      if (JSON.stringify(next) !== JSON.stringify(current)) {
        current = next;
        broadcast();
      }
    }, DEBOUNCE_MS);
  };
  watcher.on("add", scheduleRescan);
  watcher.on("addDir", scheduleRescan);
  watcher.on("unlink", scheduleRescan);
  watcher.on("unlinkDir", scheduleRescan);
  watcher.on("change", scheduleRescan);
  const close = async () => {
    clearInterval(heartbeat);
    clearTimeout(debounce ?? void 0);
    await watcher.close();
    for (const res of clients) res.end();
    clients.clear();
    const closed = Promise.withResolvers();
    server.close(() => closed.resolve());
    await closed.promise;
  };
  return { url, port, close };
}

// server/open-browser.ts
import { spawn } from "node:child_process";
function openBrowser(url) {
  let command;
  let args;
  switch (process.platform) {
    case "win32":
      command = "cmd";
      args = ["/c", "start", "", url];
      break;
    case "darwin":
      command = "open";
      args = [url];
      break;
    default:
      command = "xdg-open";
      args = [url];
      break;
  }
  try {
    const child = spawn(command, args, { detached: true, stdio: "ignore" });
    child.on("error", () => {
    });
    child.unref();
  } catch {
  }
}

// server/cli.ts
var HELP = `giraph \u2014 live architectural blueprint for any project

Usage:
  giraph [run] [options]

Commands:
  run                Scan the project, serve the blueprint UI, and watch for changes (default).

Options:
  --dir <path>       Project directory to scan (default: current directory).
  --port <n>         Port to listen on (default: 4317, falls back to a free port).
  --no-open          Do not open the browser automatically.
  -h, --help         Show this help.
`;
function parseArgs(argv) {
  const parsed = {
    command: "run",
    dir: process.cwd(),
    open: true,
    help: false
  };
  let i = 0;
  if (argv[0] && !argv[0].startsWith("-")) {
    parsed.command = argv[0];
    i = 1;
  }
  for (; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--dir":
        parsed.dir = path3.resolve(argv[++i] ?? process.cwd());
        break;
      case "--port": {
        const value = Number(argv[++i]);
        if (Number.isFinite(value)) parsed.port = value;
        break;
      }
      case "--no-open":
        parsed.open = false;
        break;
      case "-h":
      case "--help":
        parsed.help = true;
        break;
      default:
        break;
    }
  }
  return parsed;
}
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.command !== "run") {
    process.stdout.write(HELP);
    if (args.command !== "run" && !args.help) process.exitCode = 1;
    return;
  }
  const { url, close } = await startServer({ root: args.dir, port: args.port });
  process.stdout.write(`
  giraph  \u2192  ${url}
`);
  process.stdout.write(`  watching ${args.dir} for changes\u2026

`);
  if (args.open) openBrowser(url);
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    await close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}
main().catch((err) => {
  process.stderr.write(`giraph: ${err instanceof Error ? err.message : String(err)}
`);
  process.exit(1);
});
