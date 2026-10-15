import type { Movie } from "./scenef";

export type MovieSortCategory = "one-day-today" | "multi-day" | "remaining";

export function movieSortCategory(movie: Movie, today: string): MovieSortCategory {
  const hasOneDayToday = movie.runs.some((run) => (
    run.durationDays === 1 && run.dates.some((date) => date.date === today)
  ));
  if (hasOneDayToday) return "one-day-today";
  if (movie.runs.some((run) => run.durationDays > 1)) return "multi-day";
  return "remaining";
}

export function movieRatingScore(movie: Movie) {
  const ratings = [
    movie.ratings.imdb,
    movie.ratings.letterboxd === null ? null : movie.ratings.letterboxd * 2,
  ].filter((rating): rating is number => rating !== null);
  if (ratings.length === 0) return null;
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

export function movieProminence(movie: Movie) {
  return {
    theaterCount: movie.runs.length,
    showtimeCount: movie.runs.reduce(
      (total, run) => total + run.dates.reduce((sum, date) => sum + date.showtimes.length, 0),
      0,
    ),
    longestRunDays: Math.max(...movie.runs.map((run) => run.durationDays)),
  };
}

function earliestRunDate(movie: Movie) {
  return movie.runs.map((run) => run.startDate).sort()[0] ?? "";
}

export function compareMovies(first: Movie, second: Movie, today: string) {
  const categories: MovieSortCategory[] = ["one-day-today", "multi-day", "remaining"];
  const categoryDifference = categories.indexOf(movieSortCategory(first, today))
    - categories.indexOf(movieSortCategory(second, today));
  if (categoryDifference !== 0) return categoryDifference;

  const firstRating = movieRatingScore(first);
  const secondRating = movieRatingScore(second);
  if (firstRating !== secondRating) {
    if (firstRating === null) return 1;
    if (secondRating === null) return -1;
    return secondRating - firstRating;
  }

  const firstRatingCount = Number(first.ratings.imdb !== null) + Number(first.ratings.letterboxd !== null);
  const secondRatingCount = Number(second.ratings.imdb !== null) + Number(second.ratings.letterboxd !== null);
  if (firstRatingCount !== secondRatingCount) return secondRatingCount - firstRatingCount;

  const firstProminence = movieProminence(first);
  const secondProminence = movieProminence(second);
  return secondProminence.theaterCount - firstProminence.theaterCount
    || secondProminence.showtimeCount - firstProminence.showtimeCount
    || secondProminence.longestRunDays - firstProminence.longestRunDays
    || earliestRunDate(first).localeCompare(earliestRunDate(second))
    || first.title.localeCompare(second.title)
    || first.id.localeCompare(second.id);
}

export function sortMovies(movies: Movie[], today: string, pinnedIds: string[] = []) {
  const pinned = new Set(pinnedIds);
  return [...movies].sort((first, second) => (
    Number(pinned.has(second.id)) - Number(pinned.has(first.id))
    || compareMovies(first, second, today)
  ));
}
