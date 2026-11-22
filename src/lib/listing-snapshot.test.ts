import assert from "node:assert/strict";
import test from "node:test";
import { dropPastListings } from "./listing-snapshot.ts";
import { pacificCalendarDate } from "./refresh-schedule.ts";
import {
  AMC_VENUES,
  displayRunsForMovie,
  mergeAmcRunsIntoMovies,
  normalizeFeeds,
  shouldHideAmcLinkedMovie,
  type SceneFFeed,
  VENUES,
} from "./scenef.ts";

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

const film = {
  key: "tmdb-1",
  title: "A Real Film",
  year: 2026,
  directors: ["A Director"],
};

test("pacific calendar date is YYYY-MM-DD in America/Los_Angeles", () => {
  assert.equal(pacificCalendarDate(new Date("2026-11-22T07:30:00Z")), "2026-11-21");
  assert.equal(pacificCalendarDate(new Date("2026-11-22T08:30:00Z")), "2026-11-22");
});

test("past dates drop off a stored snapshot without fabricating replacements", () => {
  const roxie = VENUES.find((item) => item.id === "roxie");
  assert.ok(roxie);
  const payload = normalizeFeeds([{
    venue: roxie,
    feed: feed("roxie", [film, { key: "tmdb-2", title: "Ended Yesterday", year: 2026 }], [
      screening("past", "tmdb-1", "roxie", "2026-10-14"),
      screening("today", "tmdb-1", "roxie", "2026-10-16"),
      screening("ended", "tmdb-2", "roxie", "2026-10-14"),
    ]),
  }]);
  payload.amcExcludedMovieIds = [payload.movies.find((movie) => movie.title === "Ended Yesterday")?.id ?? ""];

  const current = dropPastListings(payload, "2026-10-16");
  assert.deepEqual(current.movies.map((movie) => movie.title), ["A Real Film"]);
  assert.deepEqual(current.movies[0].runs[0].dates.map((entry) => entry.date), ["2026-10-16"]);
  assert.equal(current.movies[0].runs[0].dates.some((entry) => entry.date === "2026-10-17"), false);
  assert.deepEqual(current.amcExcludedMovieIds, []);
  assert.equal(current.range.start, "2026-10-16");
});

test("merged AMC showtimes stay on the combined card and hide unless revealed", () => {
  const roxie = VENUES.find((item) => item.id === "roxie");
  const kabuki = AMC_VENUES.find((item) => item.id === "amc-kabuki");
  assert.ok(roxie);
  assert.ok(kabuki);
  const indie = normalizeFeeds([{
    venue: roxie,
    feed: feed("roxie", [film, { key: "tmdb-2", title: "Independent Only", year: 2026 }], [
      screening("roxie-1", "tmdb-1", "roxie", "2026-10-15"),
      screening("roxie-2", "tmdb-2", "roxie", "2026-10-16"),
    ]),
  }]);
  const amcFeeds = [{
    venue: kabuki,
    feed: feed("amc-kabuki", [{ key: "amc-1", title: "A Real Film — IMAX", year: 2026 }], [
      screening("amc-1", "amc-1", "amc-kabuki", "2026-10-15", 20),
    ]),
  }];
  const merged = mergeAmcRunsIntoMovies(indie, amcFeeds);
  merged.amcExcludedMovieIds = [merged.movies.find((movie) => movie.title === "A Real Film")?.id ?? ""];

  const combined = merged.movies.find((movie) => movie.title === "A Real Film");
  assert.ok(combined);
  assert.deepEqual(combined.runs.map((run) => run.venueId).sort(), ["amc-kabuki", "roxie"]);
  assert.equal(
    shouldHideAmcLinkedMovie(combined, merged, { showAllHidden: false, amcVenueSelected: false }),
    true,
  );
  assert.equal(
    shouldHideAmcLinkedMovie(combined, merged, { showAllHidden: true, amcVenueSelected: false }),
    false,
  );
  assert.deepEqual(
    displayRunsForMovie(combined, { showAllHidden: false, amcVenueSelected: false }).map((run) => run.venueId),
    ["roxie"],
  );
  assert.deepEqual(
    displayRunsForMovie(combined, { showAllHidden: true, amcVenueSelected: false }).map((run) => run.venueId).sort(),
    ["amc-kabuki", "roxie"],
  );
});
