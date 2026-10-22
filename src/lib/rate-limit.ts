import type { NextRequest } from "next/server";

/**
 * A simple limit on how often one visitor can call a route. The counts live
 * in this server's memory, so they reset on a restart and aren't shared
 * between Vercel's servers: a speed bump, not a wall.
 */
export function createRateLimiter({
  windowMs,
  maxPerWindow,
  maxTrackedVisitors = 5000,
}: {
  windowMs: number;
  maxPerWindow: number;
  maxTrackedVisitors?: number;
}) {
  const recent = new Map<string, number[]>();

  /** True when this visitor has used up their calls for now. */
  return function rateLimited(visitor: string, now: number): boolean {
    const times = (recent.get(visitor) ?? []).filter((t) => now - t < windowMs);
    if (times.length >= maxPerWindow) {
      recent.set(visitor, times);
      return true;
    }
    times.push(now);
    recent.set(visitor, times);
    if (recent.size > maxTrackedVisitors) {
      for (const [key, list] of recent) {
        if (list.every((t) => now - t >= windowMs)) recent.delete(key);
      }
    }
    return false;
  };
}

/** The visitor's IP address, as Vercel passes it on. */
export function visitorKey(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}
