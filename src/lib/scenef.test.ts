import assert from "node:assert/strict";
import test from "node:test";
import {
  AMC_VENUES,
  excludeMoviesPlayingAtAmc,
  isLikelyFilm,
  normalizeFeeds,
  normalizeMovieTitle,
  titlesMatch,
  VENUES,
  type SceneFFilm,
  type SceneFFeed,
} from "./scenef.ts";

const REQUIRED_THEATERS = [
  "4 Star Theatre",
  "Alamo Drafthouse",
  "Apple Cinemas Van Ness IMAX",
  "Balboa Theatre",
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

test("the default theater roster exactly matches the requested list without Castro", () => {
  assert.deepEqual(VENUES.map((item) => item.name), REQUIRED_THEATERS);
  assert.equal(VENUES.some((item) => item.id === "castro"), false);
  assert.deepEqual(Object.fromEntries(VENUES.map((item) => [item.id, item.websiteUrl])), {
    "4star": "https://www.4-star-movies.com",
    "alamo-new-mission": "https://drafthouse.com/sf#now-playing",
    "apple-van-ness": "https://www.applecinemas.com/home/68543b29ef719f9969b8ad87",
    "balboa": "https://www.balboamovies.com",
    "opera-plaza": "https://www.landmarktheatres.com",
    "marina": "https://www.lntsf.com/marina-theatre",
    "presidio": "https://www.lntsf.com/presidio-theatre",
    "regal-stonestown": "https://www.regmovies.com/theatres/regal-stonestown-galleria-1464",
    "roxie": "https://roxie.com/calendar/",
    "vogue": "https://www.voguemovies.com",
  });
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

test("non-film event labels and secret movies are excluded", () => {
  const events: SceneFFilm[] = [
    { key: "event-1", title: "LIVE MUSIC: The Wildwoods", overview: "Doors 7 PM. Music 8 PM." },
    { key: "event-2", title: "MUSIC: Nosferatu with a live score" },
    { key: "event-3", title: "Comedy At The Balboa: Tokyo Kanpai Boys" },
    { key: "event-4", title: "$5 Secret Movie 10/19/26", overview: "Be the first to see it." },
    { key: "event-5", title: "Guest Night", overview: "Live performance. Doors at 7." },
  ];
  assert.deepEqual(events.map((film) => isLikelyFilm(film)), [false, false, false, false, false]);
});

test("event filtering does not over-filter legitimate film titles", () => {
  const films: SceneFFilm[] = [
    { key: "film-1", title: "Music", year: 2021, runtimeMin: 107, directors: ["Sia"] },
    { key: "film-2", title: "They Live", year: 1988, runtimeMin: 93, directors: ["John Carpenter"] },
    { key: "film-3", title: "National Theatre Live: Frankenstein", year: 2011, runtimeMin: 130 },
    { key: "film-4", title: "The 9 Lives of Barbara Dane", year: 2023, runtimeMin: 107 },
    { key: "film-5", title: "Balboa Halloween Mystery Marathon", overview: "Four mystery horror classics. Doors at 4:15 PM." },
  ];
  assert.deepEqual(films.map((film) => isLikelyFilm(film)), [true, true, true, true, true]);
});

test("normalization reports excluded non-film entries without creating cards", () => {
  const balboa = venue("balboa");
  const payload = normalizeFeeds([{
    venue: balboa,
    feed: feed("balboa", [
      realFilm,
      { key: "event-1", title: "LIVE MUSIC: A Band" },
      { key: "event-2", title: "$5 Secret Movie 10/19/26" },
    ], [
      screening("film", "tmdb-1", "balboa", "2026-10-15"),
      screening("event-1", "event-1", "balboa", "2026-10-16"),
      screening("event-2", "event-2", "balboa", "2026-10-17"),
    ]),
  }]);

  assert.deepEqual(payload.movies.map((movie) => movie.title), ["A Real Film"]);
  assert.equal(payload.nonFilmFilter.excludedMovieCount, 2);
});
