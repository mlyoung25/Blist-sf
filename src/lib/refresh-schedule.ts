export const REFRESH_TIME_ZONE = "America/Los_Angeles";
export const REFRESH_LOCAL_HOURS = [4, 16] as const;

export function scheduledLocalHour(now: Date) {
  const hour = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone: REFRESH_TIME_ZONE,
  }).formatToParts(now).find((part) => part.type === "hour")?.value;
  return hour === undefined ? null : Number(hour);
}

export function isScheduledRefreshTime(now: Date) {
  const hour = scheduledLocalHour(now);
  return hour !== null && REFRESH_LOCAL_HOURS.includes(hour as 4 | 16);
}
