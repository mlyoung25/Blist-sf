import assert from "node:assert/strict";
import test from "node:test";
import {
  AMC_VENUES,
  excludeMoviesPlayingAtAmc,
  normalizeFeeds,
  normalizeMovieTitle,
  titlesMatch,
  VENUES,
  type SceneFFeed,
} from "./scenef.ts";

const REQUIRED_THEATERS = [
  "4 Star Theatre",
  "Alamo Drafthouse",
  "Apple Cinemas Van Ness IMAX",
  "Balboa Theatre",
  "Castro Theatre",
  "Landmark Opera Plaza Cinema",
  "Marina Theatre",
  "Presidio Theatre",
  "Regal Stonestown Galleria 12",
  "Roxie Theatre",
  "Vogue Theatre",
];

function screening(id: string, filmKey: string, venueId: string, nightOf: string, hour = 18) {
  return {
    id,
    filmKey,
    venueId,
    startsAt: `${nightOf}T${hour}:00:00-07:00`,
    nightOf,
    ticketUrl: `https://scenef.com/go/${id}`,
    confidence: "venue-published",
    source_tier: "verified-scrape",
    verified_at: "2026-10-15T08:00:00Z",
    freshness: { status: "current", source_status: "ok", retained: false },
  };
}

function feed(venueId: string, films: SceneFFeed["films"], screenings: SceneFFeed["screenings"]): SceneFFeed {
  return {
    attribution: "Showtimes via SceneF.com",
    data_as_of: "2026-10-15T08:00:00Z",
    tonight_is: { night: "2026-10-15" },
    films,
    screenings: screenings.map((item) => ({ ...item, venueId })),
  };
}

function venue(id: string) {
  const found = [...VENUES, ...AMC_VENUES].find((item) => item.id === id);
  assert.ok(found);
  return found;
}

const realFilm = {
  key: "tmdb-1",
  title: "A Real Film",
  year: 2026,
  directors: ["A Director"],
  posterUrl: "https://image.tmdb.org/poster.jpg",
};

test("the default theater roster exactly matches the requested 11", () => {
  assert.deepEqual(VENUES.map((item) => item.name), REQUIRED_THEATERS);
});

test("the same movie becomes one card with complete theater runs", () => {
  const roxie = venue("roxie");
  const balboa = venue("balboa");
  const payload = normalizeFeeds([
    {
      venue: roxie,
      feed: feed("roxie", [realFilm, { key: "tmdb-2", title: "Other Film", year: 2026 }], [
        screening("roxie-1", "tmdb-1", "roxie", "2026-10-15"),
        screening("roxie-2", "tmdb-1", "roxie", "2026-10-17"),
        screening("roxie-later", "tmdb-2", "roxie", "2026-10-20"),
      ]),
    },
    {
      venue: balboa,
      feed: feed("balboa", [realFilm], [
        screening("balboa-1", "tmdb-1", "balboa", "2026-10-16"),
        screening("balboa-2", "tmdb-1", "balboa", "2026-10-16", 20),
      ]),
    },
  ]);

  const movie = payload.movies.find((item) => item.title === "A Real Film");
  assert.ok(movie);
  assert.equal(payload.movies.filter((item) => item.title === "A Real Film").length, 1);
  assert.equal(movie.runs.length, 2);

  const roxieRun = movie.runs.find((run) => run.venueId === "roxie");
  const balboaRun = movie.runs.find((run) => run.venueId === "balboa");
  assert.deepEqual(
    { start: roxieRun?.startDate, end: roxieRun?.endDate, duration: roxieRun?.durationDays, ellipsis: roxieRun?.endsAtPublishedHorizon },
    { start: "2026-10-15", end: "2026-10-17", duration: 3, ellipsis: false },
  );
  assert.deepEqual(
    { start: balboaRun?.startDate, end: balboaRun?.endDate, duration: balboaRun?.durationDays, ellipsis: balboaRun?.endsAtPublishedHorizon, times: balboaRun?.dates[0].showtimes.length },
    { start: "2026-10-16", end: "2026-10-16", duration: 1, ellipsis: true, times: 2 },
  );
});

test("title matching normalizes punctuation, diacritics, articles, and format suffixes", () => {
  assert.equal(normalizeMovieTitle("Amélie’s & Friends"), "amelies and friends");
  assert.equal(titlesMatch("The A Real Film", "A Real Film — IMAX"), true);
  assert.equal(titlesMatch("A Real Film", "A Real Filmmaker"), false);
});

test("AMC filtering excludes the entire combined movie card by normalized title", () => {
  const roxie = venue("roxie");
  const base = normalizeFeeds([{
    venue: roxie,
    feed: feed("roxie", [realFilm, { key: "tmdb-2", title: "Independent Only", year: 2026 }], [
      screening("core-1", "tmdb-1", "roxie", "2026-10-15"),
      screening("core-2", "tmdb-2", "roxie", "2026-10-16"),
    ]),
  }]);
  const kabuki = venue("amc-kabuki");
  const filtered = excludeMoviesPlayingAtAmc(base, [{
    venue: kabuki,
    feed: feed("amc-kabuki", [{ key: "amc-1", title: "A Réal Film — IMAX", year: 2026 }], [
      screening("amc-1", "amc-1", "amc-kabuki", "2026-10-15"),
    ]),
  }]);

  assert.deepEqual(filtered.movies.map((movie) => movie.title), ["Independent Only"]);
  assert.equal(filtered.amcFilter.enabled, true);
  assert.equal(filtered.amcFilter.excludedMovieCount, 1);
  assert.deepEqual(filtered.amcFilter.excludedTitles, ["A Real Film"]);
});

test("AMC sources are exactly Kabuki and Metreon", () => {
  assert.deepEqual(AMC_VENUES.map((item) => item.id), ["amc-kabuki", "amc-metreon"]);
});
