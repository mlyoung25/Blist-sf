import { revalidateTag } from "next/cache";
import { fetchSceneFMovies, SCENEF_CACHE_TAG } from "@/lib/scenef";
import { isScheduledRefreshTime, REFRESH_TIME_ZONE } from "@/lib/refresh-schedule";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const now = new Date();
  if (!isScheduledRefreshTime(now)) {
    return Response.json({
      refreshed: false,
      reason: `Outside the 04:00/16:00 ${REFRESH_TIME_ZONE} refresh windows.`,
      checkedAt: now.toISOString(),
    });
  }

  revalidateTag(SCENEF_CACHE_TAG, { expire: 0 });
  const payload = await fetchSceneFMovies({ excludeAmc: true });

  return Response.json({
    refreshed: true,
    refreshedAt: now.toISOString(),
    dataAsOf: payload.dataAsOf,
    movieCountAfterAmcFilter: payload.movies.length,
    excludedAmcMovieCount: payload.amcFilter.excludedMovieCount,
    sourceCount: payload.sources.length,
  });
}
