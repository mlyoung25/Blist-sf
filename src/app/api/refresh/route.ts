import { revalidateTag } from "next/cache";
import { fetchSceneFMovies, SCENEF_CACHE_TAG } from "@/lib/scenef";
import { REFRESH_TIME_ZONE, VERCEL_CRON_UTC_TIME } from "@/lib/refresh-schedule";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  revalidateTag(SCENEF_CACHE_TAG, { expire: 0 });
  const payload = await fetchSceneFMovies({ fresh: true });

  return Response.json({
    refreshed: true,
    schedule: `${VERCEL_CRON_UTC_TIME} UTC daily (${REFRESH_TIME_ZONE}; 4:00 AM PST, 5:00 AM PDT)`,
    refreshedAt: now.toISOString(),
    dataAsOf: payload.dataAsOf,
    movieCountAfterAmcFilter: payload.movies.length,
    excludedAmcMovieCount: payload.amcFilter.excludedMovieCount,
    onFilmMovieCount: payload.onFilmSource.matchedMovieCount,
    onFilmSourceError: payload.onFilmSource.error ?? null,
    sourceCount: payload.sources.length,
  });
}
