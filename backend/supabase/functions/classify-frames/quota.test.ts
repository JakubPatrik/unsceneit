// Run with: node --experimental-strip-types --test backend/supabase/functions/classify-frames/quota.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { callerIp, hashIp, limitTodo, nextMonthUtc, quotaInfo, secondsNeeded } from "./quota.ts";

const todo = [
  { t: 12, filterIds: ["a", "b"] },
  { t: 10, filterIds: ["a"] },
  { t: 11, filterIds: ["a", "b"] },
];

describe("secondsNeeded", () => {
  it("counts each frame with an open question once", () => {
    assert.equal(secondsNeeded(todo, 1), 3);
    assert.equal(secondsNeeded([], 1), 0);
  });
});

describe("limitTodo", () => {
  it("keeps the earliest frames that fit", () => {
    assert.deepEqual(
      limitTodo(todo, 2, 1).map((x) => x.t),
      [10, 11]
    );
  });

  it("keeps everything when the grant covers it, nothing when it's zero", () => {
    assert.equal(limitTodo(todo, 5, 1).length, 3);
    assert.equal(limitTodo(todo, 0, 1).length, 0);
  });
});

describe("quotaInfo", () => {
  const now = new Date("2026-10-17T12:00:00Z");

  it("reports what's left and when it refills", () => {
    assert.deepEqual(quotaInfo(150, 600, 450, now), {
      limit_s: 600,
      used_s: 150,
      remaining_s: 450,
      resets_at: "2026-11-01T00:00:00.000Z",
      ip_limited: false,
    });
  });

  it("never goes below zero", () => {
    const q = quotaInfo(700, 600, 0, now);
    assert.equal(q.remaining_s, 0);
    assert.equal(q.used_s, 600);
    assert.equal(q.ip_limited, false); // the install's own allowance is the reason
  });

  it("flags a network that used its daily allowance", () => {
    assert.equal(quotaInfo(100, 600, 0, now).ip_limited, true);
  });

  it("rolls over the year", () => {
    assert.equal(nextMonthUtc(new Date("2026-12-31T23:59:00Z")).toISOString(), "2027-01-01T00:00:00.000Z");
  });
});

describe("callerIp / hashIp", () => {
  it("takes the first forwarded address", () => {
    assert.equal(callerIp(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" })), "203.0.113.5");
    assert.equal(callerIp(new Headers()), "unknown");
  });

  it("hashes with the salt, never returning the IP", async () => {
    const a = await hashIp("203.0.113.5", "s1");
    assert.match(a, /^[0-9a-f]{64}$/);
    assert.notEqual(a, await hashIp("203.0.113.5", "s2"));
    assert.equal(a, await hashIp("203.0.113.5", "s1"));
  });
});
