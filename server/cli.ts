import path from "node:path";
import { startServer } from "./server";
import { openBrowser } from "./open-browser";

interface ParsedArgs {
  command: string;
  dir: string;
  port?: number;
  open: boolean;
  help: boolean;
}

const HELP = `giraph — live architectural blueprint for any project

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

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    command: "run",
    dir: process.cwd(),
    open: true,
    help: false,
  };

  let i = 0;
  // First non-flag token is the command.
  if (argv[0] && !argv[0].startsWith("-")) {
    parsed.command = argv[0];
    i = 1;
  }

  for (; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--dir":
        parsed.dir = path.resolve(argv[++i] ?? process.cwd());
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
        // Unknown flags are ignored to stay forgiving.
        break;
    }
  }

  return parsed;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || (args.command !== "run")) {
    process.stdout.write(HELP);
    if (args.command !== "run" && !args.help) process.exitCode = 1;
    return;
  }
  const { url, close } = await startServer({ root: args.dir, port: args.port });

  process.stdout.write(`\n  giraph  \u2192  ${url}\n`);
  process.stdout.write(`  watching ${args.dir} for changes\u2026\n\n`);

  if (args.open) openBrowser(url);

  let closing = false;
  const shutdown = async (): Promise<void> => {
    if (closing) return;
    closing = true;
    await close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((err) => {
  process.stderr.write(`giraph: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
