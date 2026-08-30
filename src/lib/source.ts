import type { Blueprint } from "../types";
import { current as sampleCurrent, previous as samplePrevious } from "../data/blueprint";

export interface Snapshot {
  previous: Blueprint;
  current: Blueprint;
}

interface ApiPayload {
  baseline: Blueprint;
  current: Blueprint;
}

// Fetch the current snapshot from the running giraph server. The server exposes
// baseline/current; the UI diffs previous->current, so baseline maps to previous.
export async function fetchSnapshot(): Promise<Snapshot> {
  try {
    const res = await fetch("/api/blueprint");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { baseline, current } = (await res.json()) as ApiPayload;
    return { previous: baseline, current };
  } catch {
    // No server (e.g. plain `vite dev` or tests): fall back to the bundled sample.
    return { previous: samplePrevious, current: sampleCurrent };
  }
}

// Subscribe to live snapshots over SSE. Returns an unsubscribe function.
export function subscribeSnapshot(onSnapshot: (s: Snapshot) => void): () => void {
  if (typeof EventSource === "undefined") return () => {};
  let source: EventSource;
  try {
    source = new EventSource("/api/events");
  } catch {
    return () => {};
  }
  source.addEventListener("blueprint", (event) => {
    try {
      const { baseline, current } = JSON.parse((event as MessageEvent).data) as ApiPayload;
      onSnapshot({ previous: baseline, current });
    } catch {
      // Ignore malformed payloads.
    }
  });
  return () => source.close();
}
