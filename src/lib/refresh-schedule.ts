export const REFRESH_TIME_ZONE = "America/Los_Angeles";

/** YYYY-MM-DD in Pacific time, used to drop past showtimes from a stored snapshot. */
export function pacificCalendarDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REFRESH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export const REFRESH_LOCAL_HOUR = 4;
/** Single Vercel Hobby cron: daily at 12:00 UTC. */
export const VERCEL_CRON_SCHEDULE = "0 12 * * *";
export const VERCEL_CRON_UTC_TIME = "12:00";

export function scheduledLocalHour(now: Date) {
  const hour = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: REFRESH_TIME_ZONE,
  }).formatToParts(now).find((part) => part.type === "hour")?.value;
  return hour === undefined ? null : Number(hour);
}

/** Local wall-clock hour when the configured UTC cron runs on the given calendar day. */
export function localHourAtVercelCron(now: Date) {
  const utcYear = now.getUTCFullYear();
  const utcMonth = now.getUTCMonth();
  const utcDate = now.getUTCDate();
  return scheduledLocalHour(new Date(Date.UTC(utcYear, utcMonth, utcDate, 12, 0, 0)));
}
