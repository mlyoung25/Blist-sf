import assert from "node:assert/strict";
import test from "node:test";
import { isScheduledRefreshTime, scheduledLocalHour } from "./refresh-schedule.ts";

test("refresh guard follows Pacific Standard Time", () => {
  assert.equal(scheduledLocalHour(new Date("2026-01-15T12:00:00Z")), 4);
  assert.equal(scheduledLocalHour(new Date("2026-01-16T00:00:00Z")), 16);
  assert.equal(isScheduledRefreshTime(new Date("2026-01-15T11:00:00Z")), false);
});

test("refresh guard follows Pacific Daylight Time", () => {
  assert.equal(scheduledLocalHour(new Date("2026-07-15T11:00:00Z")), 4);
  assert.equal(scheduledLocalHour(new Date("2026-07-15T23:00:00Z")), 16);
  assert.equal(isScheduledRefreshTime(new Date("2026-07-15T12:00:00Z")), false);
});
