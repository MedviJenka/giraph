import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chokidar, { type FSWatcher } from "chokidar";
import ignore, { type Ignore } from "ignore";
import type { Blueprint } from "../src/types";
import { scanProject } from "./scanner";

export interface StartServerOptions {
  root: string;
  port?: number;
}

export interface RunningServer {
  url: string;
  port: number;
  close: () => Promise<void>;
}

const DEFAULT_PORT = 4317;
const HEARTBEAT_MS = 25_000;
const DEBOUNCE_MS = 150;

// Directories that are always excluded from both the scan and the watcher.
const ALWAYS_IGNORED: Record<string, true> = {
  ".git": true,
  node_modules: true,
  dist: true,
  "dist-server": true,
  ".blueprint": true,
  ".vite": true,
};

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

/** Payload sent over both the JSON endpoint and SSE. */
interface Snapshot {
  baseline: Blueprint;
  current: Blueprint;
}

/**
 * Build a matcher mirroring the scanner's ignore rules so the watcher does not
 * fire on files the scan would never include. Applies the always-ignored set,
 * the repo's `.gitignore`, and dot-directories.
 */
function createIgnoreMatcher(root: string): (absPath: string, stats?: fs.Stats) => boolean {
  const ig: Ignore = ignore();
  const gitignorePath = path.join(root, ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    ig.add(fs.readFileSync(gitignorePath, "utf8"));
  }

  return (absPath, stats) => {
    const rel = path.relative(root, absPath).split(path.sep).join("/");
    if (rel === "" || rel.startsWith("..")) return false;
    const segments = rel.split("/");
    if (segments.some((seg) => ALWAYS_IGNORED[seg])) return true;
    // Dot-directories (e.g. .vite) are excluded like the scanner does.
    const base = segments[segments.length - 1];
    if (base.startsWith(".") && stats?.isDirectory()) return true;
    // gitignore directory rules (e.g. `secret/`) only match with a trailing slash.
    return ig.ignores(stats?.isDirectory() ? `${rel}/` : rel);
  };
}

/** Resolve the packaged UI build dir. Honors the GIRAPH_DIST override. */
function resolveDistDir(): string {
  const override = process.env.GIRAPH_DIST;
  if (override) return path.resolve(override);
  // Compiled bundle lives at <pkgRoot>/dist-server/cli.js; the UI is at
  // <pkgRoot>/dist. Resolve two levels up from this module.
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "dist");
}

/** Listen on the requested port, falling back to an ephemeral free port. */
function listen(server: http.Server, port: number): Promise<number> {
  const { promise, resolve, reject } = Promise.withResolvers<number>();
  const onError = (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE" && port !== 0) {
      server.removeListener("error", onError);
      // Retry on an ephemeral port.
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

export async function startServer(opts: StartServerOptions): Promise<RunningServer> {
  const root = path.resolve(opts.root);
  const distDir = resolveDistDir();

  const baseline = scanProject(root);
  let current = baseline;

  const clients = new Set<http.ServerResponse>();

  const snapshotJson = (): string =>
    JSON.stringify({ baseline, current } satisfies Snapshot);

  const sendSnapshot = (res: http.ServerResponse): void => {
    res.write(`event: blueprint\ndata: ${snapshotJson()}\n\n`);
  };

  const broadcast = (): void => {
    const payload = `event: blueprint\ndata: ${snapshotJson()}\n\n`;
    for (const res of clients) res.write(payload);
  };

  const serveStatic = (req: http.IncomingMessage, res: http.ServerResponse): void => {
    const indexPath = path.join(distDir, "index.html");
    if (!fs.existsSync(indexPath)) {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end(
        "giraph UI is not built yet. Run `npm run build` to generate the dist/ directory.\n"
      );
      return;
    }

    const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
    let filePath = path.join(distDir, urlPath);
    // Prevent path traversal outside the dist dir.
    if (!filePath.startsWith(distDir)) filePath = indexPath;

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // SPA fallback: unknown non-asset routes serve index.html.
        serveFile(indexPath, res);
        return;
      }
      serveFile(filePath, res);
    });
  };

  const serveFile = (filePath: string, res: http.ServerResponse): void => {
    const type = MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    fs.createReadStream(filePath).pipe(res);
  };

  const server = http.createServer((req, res) => {
    const url = (req.url ?? "/").split("?")[0];

    if (url === "/api/blueprint") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(snapshotJson());
      return;
    }

    if (url === "/api/events") {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
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

  // Keep SSE connections alive through proxies/idle timeouts.
  const heartbeat = setInterval(() => {
    for (const res of clients) res.write(": ping\n\n");
  }, HEARTBEAT_MS);

  // Watch the project and rescan (debounced) when files change.
  const isIgnored = createIgnoreMatcher(root);
  const watcher: FSWatcher = chokidar.watch(root, {
    ignoreInitial: true,
    ignored: (p: string, stats?: fs.Stats) => isIgnored(p, stats),
  });

  let debounce: NodeJS.Timeout | null = null;
  const scheduleRescan = (): void => {
    clearTimeout(debounce ?? undefined);
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

  const close = async (): Promise<void> => {
    clearInterval(heartbeat);
    clearTimeout(debounce ?? undefined);
    await watcher.close();
    for (const res of clients) res.end();
    clients.clear();
    const closed = Promise.withResolvers<void>();
    server.close(() => closed.resolve());
    await closed.promise;
  };

  return { url, port, close };
}
