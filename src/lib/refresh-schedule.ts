export const REFRESH_TIME_ZONE = "America/Los_Angeles";
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
