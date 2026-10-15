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
  return movie.ratings.imdb;
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

export function movieStartDate(movie: Movie) {
  return movie.runs.map((run) => run.startDate).sort()[0] ?? "";
}

export function movieStartMonth(movie: Movie) {
  return movieStartDate(movie).slice(0, 7);
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

  const firstProminence = movieProminence(first);
  const secondProminence = movieProminence(second);
  return secondProminence.theaterCount - firstProminence.theaterCount
    || secondProminence.showtimeCount - firstProminence.showtimeCount
    || secondProminence.longestRunDays - firstProminence.longestRunDays
    || movieStartDate(first).localeCompare(movieStartDate(second))
    || first.title.localeCompare(second.title)
    || first.id.localeCompare(second.id);
}

export function sortMovies(movies: Movie[], today: string, pinnedIds: string[] = []) {
  const pinned = new Set(pinnedIds);
  return [...movies].sort((first, second) => {
    const firstPinned = pinned.has(first.id);
    const secondPinned = pinned.has(second.id);
    const pinnedDifference = Number(secondPinned) - Number(firstPinned);
    if (pinnedDifference !== 0) return pinnedDifference;
    if (firstPinned && secondPinned) return compareMovies(first, second, today);
    return movieStartMonth(first).localeCompare(movieStartMonth(second))
      || compareMovies(first, second, today);
  });
}
