import assert from "node:assert/strict";
import test from "node:test";
import {
  compareMovies,
  movieProminence,
  movieRatingScore,
  movieSortCategory,
  movieStartMonth,
  sortMovies,
} from "./movie-sort.ts";
import type { Movie, TheaterRun } from "./scenef.ts";

function run(overrides: Partial<TheaterRun> = {}): TheaterRun {
  return {
    venueId: "roxie",
    venueName: "Roxie Theatre",
    sourceUrl: "https://scenef.com/theater/roxie",
    websiteUrl: "https://roxie.com/calendar/",
    startDate: "2026-10-15",
    endDate: "2026-10-15",
    durationDays: 1,
    endsAtPublishedHorizon: false,
    dates: [{
      date: "2026-10-15",
      showtimes: [{
        id: "show-1",
        startsAt: "2026-10-15T18:00:00-07:00",
        label: "6:00 PM",
        ticketUrl: "https://scenef.com/go/show-1",
      }],
    }],
    sourceTier: "verified-scrape",
    confidence: "venue-published",
    verifiedAt: "2026-10-15T08:00:00Z",
    freshness: { status: "current" },
    note: null,
    ...overrides,
  };
}

function movie(id: string, overrides: Partial<Movie> = {}): Movie {
  return {
    id,
    tmdbId: 1,
    imdbId: "tt0000001",
    title: id,
    normalizedTitle: id,
    directors: [],
    year: 2026,
    runtimeMin: 90,
    rating: "NR",
    genres: [],
    overview: null,
    posterUrl: null,
    ratings: { imdb: 7, letterboxd: null },
    runs: [run()],
    ...overrides,
  };
}

test("sort categories prioritize one-day today, multi-day, then other-day movies", () => {
  const today = movie("today");
  const multi = movie("multi", {
    runs: [run({
      startDate: "2026-10-16",
      endDate: "2026-10-20",
      durationDays: 5,
      dates: [{ date: "2026-10-16", showtimes: [] }],
    })],
  });
  const later = movie("later", {
    runs: [run({
      startDate: "2026-10-18",
      endDate: "2026-10-18",
      dates: [{ date: "2026-10-18", showtimes: [] }],
    })],
  });

  assert.equal(movieSortCategory(today, "2026-10-15"), "one-day-today");
  assert.equal(movieSortCategory(multi, "2026-10-15"), "multi-day");
  assert.equal(movieSortCategory(later, "2026-10-15"), "remaining");
  assert.deepEqual(sortMovies([later, multi, today], "2026-10-15").map((item) => item.id), ["today", "multi", "later"]);
});

test("ratings sort descending within a category and normalize Letterboxd to ten points", () => {
  const imdb = movie("IMDb 8", { ratings: { imdb: 8, letterboxd: null } });
  const letterboxd = movie("Letterboxd 4.5", { ratings: { imdb: null, letterboxd: 4.5 } });
  const unavailable = movie("Unavailable", { ratings: { imdb: null, letterboxd: null } });

  assert.equal(movieRatingScore(letterboxd), 9);
  assert.deepEqual(
    sortMovies([unavailable, imdb, letterboxd], "2026-10-15").map((item) => item.id),
    ["Letterboxd 4.5", "IMDb 8", "Unavailable"],
  );
});

test("prominence deterministically breaks rating ties", () => {
  const baseRun = run({
    startDate: "2026-10-16",
    endDate: "2026-10-18",
    durationDays: 3,
    dates: [{ date: "2026-10-16", showtimes: [] }],
  });
  const broad = movie("Broad", { runs: [baseRun, { ...baseRun, venueId: "balboa", venueName: "Balboa Theatre" }] });
  const frequent = movie("Frequent", {
    runs: [{ ...baseRun, dates: [{ date: "2026-10-16", showtimes: [run().dates[0].showtimes[0], { ...run().dates[0].showtimes[0], id: "show-2" }] }] }],
  });
  const long = movie("Long", { runs: [{ ...baseRun, endDate: "2026-10-20", durationDays: 5 }] });
  const ordinary = movie("Ordinary", { runs: [baseRun] });

  assert.deepEqual(movieProminence(broad), { theaterCount: 2, showtimeCount: 0, longestRunDays: 3 });
  assert.ok(compareMovies(broad, frequent, "2026-10-15") < 0);
  assert.ok(compareMovies(frequent, long, "2026-10-15") < 0);
  assert.ok(compareMovies(long, ordinary, "2026-10-15") < 0);
});

test("pins remain above the computed order", () => {
  const today = movie("Today");
  const future = movie("Future", {
    runs: [run({
      startDate: "2026-10-18",
      endDate: "2026-10-18",
      dates: [{ date: "2026-10-18", showtimes: [] }],
    })],
  });
  assert.deepEqual(sortMovies([today, future], "2026-10-15", ["Future"]).map((item) => item.id), ["Future", "Today"]);
});

test("global pins precede month-grouped movies with priorities confined to each month", () => {
  const octoberMulti = movie("October multi", {
    ratings: { imdb: 5, letterboxd: null },
    runs: [run({
      startDate: "2026-10-20",
      endDate: "2026-11-03",
      durationDays: 15,
      dates: [{ date: "2026-10-20", showtimes: [] }],
    })],
  });
  const octoberRated = movie("October rated", {
    ratings: { imdb: 9, letterboxd: null },
    runs: [run({
      startDate: "2026-10-18",
      endDate: "2026-10-18",
      dates: [{ date: "2026-10-18", showtimes: [] }],
    })],
  });
  const novemberPinned = movie("November pinned", {
    ratings: { imdb: 1, letterboxd: null },
    runs: [run({
      startDate: "2026-11-20",
      endDate: "2026-11-20",
      dates: [{ date: "2026-11-20", showtimes: [] }],
    })],
  });
  const novemberRated = movie("November rated", {
    ratings: { imdb: 10, letterboxd: null },
    runs: [run({
      startDate: "2026-11-02",
      endDate: "2026-11-05",
      durationDays: 4,
      dates: [{ date: "2026-11-02", showtimes: [] }],
    })],
  });
  const decemberPinned = movie("December pinned", {
    runs: [run({
      startDate: "2026-12-01",
      endDate: "2026-12-01",
      dates: [{ date: "2026-12-01", showtimes: [] }],
    })],
  });

  const sorted = sortMovies(
    [decemberPinned, novemberRated, octoberRated, novemberPinned, octoberMulti],
    "2026-10-15",
    ["November pinned", "December pinned"],
  );

  assert.deepEqual(sorted.map((item) => item.id), [
    "December pinned",
    "November pinned",
    "October multi",
    "October rated",
    "November rated",
  ]);
  assert.deepEqual(sorted.slice(2).map(movieStartMonth), [
    "2026-10",
    "2026-10",
    "2026-11",
  ]);
  assert.equal(movieStartMonth(octoberMulti), "2026-10");
});
