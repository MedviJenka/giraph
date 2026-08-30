import { build } from "esbuild";
import { chmodSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outfile = path.join(root, "dist-server", "cli.js");

await build({
  entryPoints: [path.join(root, "server", "cli.ts")],
  outfile,
  platform: "node",
  format: "esm",
  target: "node20",
  bundle: true,
  packages: "external",
  banner: { js: "#!/usr/bin/env node" },
  sourcemap: false,
});

// Make the bin executable on POSIX; irrelevant on Windows.
if (process.platform !== "win32") {
  chmodSync(outfile, 0o755);
}

console.log(`built ${path.relative(root, outfile)}`);
