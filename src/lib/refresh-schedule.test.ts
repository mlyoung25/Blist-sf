import assert from "node:assert/strict";
import test from "node:test";
import {
  localHourAtVercelCron,
  REFRESH_LOCAL_HOUR,
  scheduledLocalHour,
  VERCEL_CRON_SCHEDULE,
  VERCEL_CRON_UTC_TIME,
} from "./refresh-schedule.ts";

test("vercel cron uses one daily utc schedule for hobby", () => {
  assert.equal(VERCEL_CRON_SCHEDULE, "0 12 * * *");
  assert.equal(VERCEL_CRON_UTC_TIME, "12:00");
  assert.equal(REFRESH_LOCAL_HOUR, 4);
});

test("12:00 utc maps to 4:00 am pacific during standard time", () => {
  const cronInstant = new Date("2026-01-15T12:00:00Z");
  assert.equal(scheduledLocalHour(cronInstant), 4);
  assert.equal(localHourAtVercelCron(cronInstant), 4);
});

test("12:00 utc maps to 5:00 am pacific during daylight saving time", () => {
  const cronInstant = new Date("2026-07-15T12:00:00Z");
  assert.equal(scheduledLocalHour(cronInstant), 5);
  assert.equal(localHourAtVercelCron(cronInstant), 5);
});

test("refresh schedule no longer includes a 4 pm pacific window", () => {
  assert.equal(scheduledLocalHour(new Date("2026-01-16T00:00:00Z")), 16);
  assert.notEqual(scheduledLocalHour(new Date("2026-01-16T00:00:00Z")), REFRESH_LOCAL_HOUR);
});
