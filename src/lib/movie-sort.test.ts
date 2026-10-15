import assert from "node:assert/strict";
import test from "node:test";
import {
  compareMovies,
  movieRatingScore,
  movieRelevantDate,
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
    ratings: { imdb: 7 },
    sceneFSlug: `${id.toLowerCase().replaceAll(" ", "-")}-2026`,
    onFilm: { matched: false, sourceUrl: null },
    runs: [run()],
    ...overrides,
  };
}

test("earliest relevant showing date sorts before IMDb rating within a month", () => {
  const earlierLowRated = movie("Earlier low rated", {
    ratings: { imdb: 2 },
    runs: [run({
      startDate: "2026-10-16",
      endDate: "2026-10-16",
      dates: [{ date: "2026-10-16", showtimes: [] }],
    })],
  });
  const laterHighRated = movie("Later high rated", {
    ratings: { imdb: 10 },
    runs: [run({
      startDate: "2026-10-18",
      endDate: "2026-10-18",
      dates: [{ date: "2026-10-18", showtimes: [] }],
    })],
  });

  assert.deepEqual(
    sortMovies([laterHighRated, earlierLowRated]).map((item) => item.id),
    ["Earlier low rated", "Later high rated"],
  );
});

test("IMDb ratings sort descending only for the same relevant day", () => {
  const high = movie("IMDb 9", { ratings: { imdb: 9 } });
  const lower = movie("IMDb 8", { ratings: { imdb: 8 } });
  const unavailable = movie("Unavailable", { ratings: { imdb: null } });

  assert.equal(movieRatingScore(high), 9);
  assert.deepEqual(
    sortMovies([unavailable, lower, high]).map((item) => item.id),
    ["IMDb 9", "IMDb 8", "Unavailable"],
  );
});

test("selected date becomes the relevant date and stable title breaks ties", () => {
  const alpha = movie("Alpha", {
    runs: [run({
      startDate: "2026-10-15",
      endDate: "2026-10-20",
      durationDays: 6,
      dates: [
        { date: "2026-10-15", showtimes: [] },
        { date: "2026-10-20", showtimes: [] },
      ],
    })],
  });
  const beta = movie("Beta", {
    runs: [run({
      startDate: "2026-10-20",
      endDate: "2026-10-20",
      dates: [{ date: "2026-10-20", showtimes: [] }],
    })],
  });
  assert.equal(movieRelevantDate(alpha, "2026-10-20"), "2026-10-20");
  assert.ok(compareMovies(alpha, beta, "2026-10-20") < 0);
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
  assert.deepEqual(sortMovies([today, future], null, ["Future"]).map((item) => item.id), ["Future", "Today"]);
});

test("global pins precede chronological month and showing-date groups", () => {
  const octoberLater = movie("October later", {
    ratings: { imdb: 5 },
    runs: [run({
      startDate: "2026-10-20",
      endDate: "2026-11-03",
      durationDays: 15,
      dates: [{ date: "2026-10-20", showtimes: [] }],
    })],
  });
  const octoberEarlier = movie("October earlier", {
    ratings: { imdb: 9 },
    runs: [run({
      startDate: "2026-10-18",
      endDate: "2026-10-18",
      dates: [{ date: "2026-10-18", showtimes: [] }],
    })],
  });
  const novemberPinned = movie("November pinned", {
    ratings: { imdb: 1 },
    runs: [run({
      startDate: "2026-11-20",
      endDate: "2026-11-20",
      dates: [{ date: "2026-11-20", showtimes: [] }],
    })],
  });
  const novemberRated = movie("November rated", {
    ratings: { imdb: 10 },
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
    [decemberPinned, novemberRated, octoberEarlier, novemberPinned, octoberLater],
    null,
    ["November pinned", "December pinned"],
  );

  assert.deepEqual(sorted.map((item) => item.id), [
    "November pinned",
    "December pinned",
    "October earlier",
    "October later",
    "November rated",
  ]);
  assert.deepEqual(sorted.slice(2).map(movieStartMonth), [
    "2026-10",
    "2026-10",
    "2026-11",
  ]);
  assert.equal(movieStartMonth(octoberLater), "2026-10");
});
