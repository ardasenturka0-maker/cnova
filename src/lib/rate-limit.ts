type RateLimitEntry = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

const globalStore = globalThis as unknown as {
  __clinicnovaRateLimits?: Map<string, RateLimitEntry>;
};

const store = globalStore.__clinicnovaRateLimits ?? new Map<string, RateLimitEntry>();
globalStore.__clinicnovaRateLimits = store;

export function takeRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}): RateLimitResult {
  const now = input.now ?? Date.now();
  const current = store.get(input.key);
  const entry = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + input.windowMs }
    : current;

  entry.count += 1;
  store.set(input.key, entry);

  const allowed = entry.count <= input.limit;
  return {
    allowed,
    remaining: Math.max(input.limit - entry.count, 0),
    resetAt: entry.resetAt,
    retryAfterSeconds: Math.max(Math.ceil((entry.resetAt - now) / 1000), 1)
  };
}

export function requestClientId(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

export function resetRateLimitsForTests() {
  store.clear();
}
