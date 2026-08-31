import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { scanProject } from "./scanner";

let root: string;

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "giraph-scan-"));
  fs.mkdirSync(path.join(root, "src", "services"), { recursive: true });
  fs.mkdirSync(path.join(root, "secret"));
  fs.writeFileSync(path.join(root, ".gitignore"), "ignored.txt\nsecret/\n");
  fs.writeFileSync(
    path.join(root, "src", "index.ts"),
    "import { greet } from './services/greeter';\n",
  );
  fs.writeFileSync(
    path.join(root, "src", "services", "greeter.ts"),
    "export const greet = () => 'hi';\n",
  );
  fs.writeFileSync(path.join(root, "ignored.txt"), "nope");
  fs.writeFileSync(path.join(root, "secret", "key.txt"), "shh");
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("scanProject", () => {
  it("turns files and directories into nodes with correct types", () => {
    const byId = new Map(scanProject(root).nodes.map((n) => [n.id, n]));
    expect(byId.get(".")?.type).toBe("Repository");
    expect(byId.get("src")?.type).toBe("Directory");
    expect(byId.get("src/services")?.type).toBe("Directory");
    expect(byId.get("src/index.ts")?.type).toBe("Module");
    // classified via the "services" path segment.
    expect(byId.get("src/services/greeter.ts")?.type).toBe("Service");
  });

  it("excludes .gitignore'd paths", () => {
    const ids = new Set(scanProject(root).nodes.map((n) => n.id));
    expect(ids.has("ignored.txt")).toBe(false);
    expect(ids.has("secret")).toBe(false);
    expect(ids.has("secret/key.txt")).toBe(false);
  });

  it("emits an imports edge for a resolved relative import", () => {
    const edge = scanProject(root).edges.find((e) => e.relationship === "imports");
    expect(edge).toEqual({
      source: "src/index.ts",
      target: "src/services/greeter.ts",
      relationship: "imports",
    });
  });

  it("is deterministic across repeated scans of an unchanged tree", () => {
    expect(JSON.stringify(scanProject(root))).toBe(JSON.stringify(scanProject(root)));
  });

  it("changes a node signature when file content changes", () => {
    const target = path.join(root, "src", "index.ts");
    const before = scanProject(root).nodes.find((n) => n.id === "src/index.ts")!.signature;
    fs.writeFileSync(
      target,
      "import { greet } from './services/greeter';\nconsole.log(greet());\n",
    );
    const after = scanProject(root).nodes.find((n) => n.id === "src/index.ts")!.signature;
    expect(after).not.toBe(before);
  });
});
