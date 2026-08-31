// Tiny, dependency-free identifier helpers used across the models layer.

let counter = 0;

/** Monotonic, collision-resistant id with a type prefix (e.g. `usr_1a2b3c`). */
export function newId(prefix: string): string {
  counter = (counter + 1) % 0xffffff;
  const time = Date.now().toString(36);
  const seq = counter.toString(36).padStart(4, "0");
  const rand = Math.floor(Math.random() * 0xffff).toString(36);
  return `${prefix}_${time}${seq}${rand}`;
}

/** ISO timestamp for the current instant; centralised so tests can stub it. */
export function now(): string {
  return new Date().toISOString();
}
