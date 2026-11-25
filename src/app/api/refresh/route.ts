import { connection } from "next/server";
import { refreshListingSnapshot } from "@/lib/listing-refresh";
import { REFRESH_TIME_ZONE, VERCEL_CRON_UTC_TIME } from "@/lib/refresh-schedule";

export const maxDuration = 60;

export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  const stored = await refreshListingSnapshot(now);
  const payload = stored.payload;
  const amcShowtimeCount = payload.movies.reduce((count, movie) => (
    count + movie.runs.filter((run) => run.venueId === "amc-kabuki" || run.venueId === "amc-metreon")
      .reduce((showtimes, run) => showtimes + run.dates.reduce((sum, date) => sum + date.showtimes.length, 0), 0)
  ), 0);

  return Response.json({
    refreshed: true,
    stored: true,
    storage: stored.kind,
    schedule: `${VERCEL_CRON_UTC_TIME} UTC daily (${REFRESH_TIME_ZONE}; 4:00 AM PST, 5:00 AM PDT)`,
    refreshedAt: now.toISOString(),
    storedAt: stored.storedAt,
    dataAsOf: payload.dataAsOf,
    movieCount: payload.movies.length,
    amcLinkedTitleCount: payload.amcExcludedMovieIds.length,
    amcShowtimeCount,
    onFilmMovieCount: payload.onFilmSource.matchedMovieCount,
    onFilmSourceError: payload.onFilmSource.error ?? null,
    sourceCount: payload.sources.length,
  });
}
