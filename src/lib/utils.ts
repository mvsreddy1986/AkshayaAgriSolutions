/** Rounds n to 2 decimal places. */
export function r2(n: number): number { return Math.round(n * 100) / 100; }

/** Rounds n to 3 decimal places. */
export function r3(n: number): number { return Math.round(n * 1000) / 1000; }

/** Extracts a human-readable message from an unknown caught value. */
export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null) {
    if ("message" in e) return String((e as { message: unknown }).message);
    if ("details" in e) return String((e as { details: unknown }).details);
    try { return JSON.stringify(e); } catch { /* fall through */ }
  }
  return String(e);
}
