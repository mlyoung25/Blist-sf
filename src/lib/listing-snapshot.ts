import { calendarDays, type Movie, type MoviesPayload, type TheaterRun } from "./scenef.ts";

function trimRun(run: TheaterRun, today: string): TheaterRun | null {
  const dates = run.dates.filter((entry) => entry.date >= today);
  if (dates.length === 0) return null;
  const startDate = dates[0].date;
  const endDate = dates.at(-1)?.date ?? startDate;
  return {
    ...run,
    startDate,
    endDate,
    durationDays: calendarDays(startDate, endDate),
    dates,
  };
}

function trimMovie(movie: Movie, today: string): Movie | null {
  const runs = movie.runs.flatMap((run) => {
    const next = trimRun(run, today);
    return next ? [next] : [];
  });
  if (runs.length === 0) return null;
  return { ...movie, runs };
}

/** Drop dates before `today` from a stored snapshot. Never invents replacement showtimes. */
export function dropPastListings(payload: MoviesPayload, today: string): MoviesPayload {
  const movies = payload.movies.flatMap((movie) => {
    const next = trimMovie(movie, today);
    return next ? [next] : [];
  });
  const remainingIds = new Set(movies.map((movie) => movie.id));
  const amcExcludedMovieIds = payload.amcExcludedMovieIds.filter((id) => remainingIds.has(id));
  const dates = movies.flatMap((movie) => movie.runs.flatMap((run) => run.dates.map((entry) => entry.date))).sort();
  const start = dates[0] ?? today;
  const end = dates.at(-1) ?? start;

  return {
    ...payload,
    range: { start, end, days: calendarDays(start, end) },
    movies,
    amcExcludedMovieIds,
    amcFilter: {
      ...payload.amcFilter,
      excludedMovieCount: amcExcludedMovieIds.length,
      excludedTitles: [...new Set(
        movies.filter((movie) => amcExcludedMovieIds.includes(movie.id)).map((movie) => movie.title),
      )].sort(),
    },
    onFilmSource: {
      ...payload.onFilmSource,
      matchedMovieCount: movies.filter((movie) => movie.onFilm.matched).length,
    },
    languageMetadata: {
      ...payload.languageMetadata,
      matchedMovieCount: movies.filter((movie) => movie.languages.length > 0).length,
    },
  };
}
