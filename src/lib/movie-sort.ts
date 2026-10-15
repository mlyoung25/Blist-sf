import type { Movie } from "./scenef";

export function movieRatingScore(movie: Movie) {
  return movie.ratings.imdb;
}

export function movieStartDate(movie: Movie) {
  return movie.runs.map((run) => run.startDate).sort()[0] ?? "";
}

export function movieStartMonth(movie: Movie) {
  return movieStartDate(movie).slice(0, 7);
}

export function movieRelevantDate(movie: Movie, selectedDate: string | null = null) {
  const dates = movie.runs.flatMap((run) => run.dates.map((date) => date.date)).sort();
  if (selectedDate && dates.includes(selectedDate)) return selectedDate;
  return dates[0] ?? movieStartDate(movie);
}

export function compareMovies(first: Movie, second: Movie, selectedDate: string | null = null) {
  const dateDifference = movieRelevantDate(first, selectedDate).localeCompare(movieRelevantDate(second, selectedDate));
  if (dateDifference !== 0) return dateDifference;
  const firstRating = movieRatingScore(first);
  const secondRating = movieRatingScore(second);
  if (firstRating !== secondRating) {
    if (firstRating === null) return 1;
    if (secondRating === null) return -1;
    return secondRating - firstRating;
  }

  return first.title.localeCompare(second.title)
    || first.id.localeCompare(second.id);
}

export function sortMovies(movies: Movie[], selectedDate: string | null = null, pinnedIds: string[] = []) {
  const pinned = new Set(pinnedIds);
  return [...movies].sort((first, second) => {
    const firstPinned = pinned.has(first.id);
    const secondPinned = pinned.has(second.id);
    const pinnedDifference = Number(secondPinned) - Number(firstPinned);
    if (pinnedDifference !== 0) return pinnedDifference;
    if (firstPinned && secondPinned) return compareMovies(first, second, selectedDate);
    return movieStartMonth(first).localeCompare(movieStartMonth(second))
      || compareMovies(first, second, selectedDate);
  });
}
