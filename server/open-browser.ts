import { spawn } from "node:child_process";

/**
 * Open a URL in the user's default browser without any external dependency.
 * Spawns detached and swallows errors — failing to open a browser must never
 * crash the server.
 */
export function openBrowser(url: string): void {
  let command: string;
  let args: string[];

  switch (process.platform) {
    case "win32":
      // `start` is a cmd builtin; the empty "" is the (ignored) window title.
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
    child.on("error", () => {});
    child.unref();
  } catch {
    // Ignore — opening a browser is best-effort.
  }
}
