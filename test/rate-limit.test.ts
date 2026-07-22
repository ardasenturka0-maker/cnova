import assert from "node:assert/strict";
import test from "node:test";
import { resetRateLimitsForTests, takeRateLimit } from "../src/lib/rate-limit";

test.beforeEach(() => resetRateLimitsForTests());

test("rate limit allows requests within the window", () => {
  const first = takeRateLimit({ key: "login:1", limit: 2, windowMs: 1_000, now: 1_000 });
  const second = takeRateLimit({ key: "login:1", limit: 2, windowMs: 1_000, now: 1_100 });

  assert.equal(first.allowed, true);
  assert.equal(first.remaining, 1);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);
});

test("rate limit blocks excess requests and resets", () => {
  takeRateLimit({ key: "login:1", limit: 1, windowMs: 1_000, now: 1_000 });
  const blocked = takeRateLimit({ key: "login:1", limit: 1, windowMs: 1_000, now: 1_200 });
  const reset = takeRateLimit({ key: "login:1", limit: 1, windowMs: 1_000, now: 2_001 });

  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 1);
  assert.equal(reset.allowed, true);
});
