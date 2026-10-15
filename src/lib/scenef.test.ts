import assert from "node:assert/strict";
import test from "node:test";
import { normalizeFeeds, VENUES, type SceneFFeed } from "./scenef.ts";

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

function feed(screenings: SceneFFeed["screenings"]): SceneFFeed {
  return {
    attribution: "Showtimes via SceneF.com",
    data_as_of: "2026-10-15T08:00:00Z",
    tonight_is: { night: "2026-10-15" },
    films: [{
      key: "film-1",
      title: "A Real Film",
      year: 2026,
      directors: ["A Director"],
    }],
    screenings,
  };
}

test("the non-AMC theater list exactly matches the requested set", () => {
  assert.deepEqual(
    VENUES.filter((venue) => !venue.isAmc).map((venue) => venue.name),
    REQUIRED_THEATERS,
  );
});

test("normalization only emits supplied SceneF screenings inside a 14-day window", () => {
  const venue = VENUES.find((item) => item.id === "roxie");
  assert.ok(venue);

  const payload = normalizeFeeds([{
    venue,
    feed: feed([
      {
        id: "show-1",
        filmKey: "film-1",
        venueId: "roxie",
        startsAt: "2026-10-15T18:00:00-07:00",
        nightOf: "2026-10-15",
        ticketUrl: "https://scenef.com/go/show-1",
      },
      {
        id: "show-2",
        filmKey: "film-1",
        venueId: "roxie",
        startsAt: "2026-10-15T20:00:00-07:00",
        nightOf: "2026-10-15",
        ticketUrl: "https://scenef.com/go/show-2",
      },
      {
        id: "outside-window",
        filmKey: "film-1",
        venueId: "roxie",
        startsAt: "2026-10-29T18:00:00-07:00",
        nightOf: "2026-10-29",
        ticketUrl: "https://scenef.com/go/outside-window",
      },
    ]),
  }]);

  assert.deepEqual(payload.range, {
    start: "2026-10-15",
    end: "2026-10-28",
    days: 14,
  });
  assert.equal(payload.listings.length, 1);
  assert.deepEqual(payload.listings[0].showtimes.map((showtime) => showtime.id), ["show-1", "show-2"]);
  assert.equal(payload.listings[0].venueName, "Roxie Theatre");
  assert.equal(payload.listings[0].sourceUrl, "https://scenef.com/theater/roxie");
});

test("AMC records remain identifiable for the UI toggle", () => {
  const amc = VENUES.filter((venue) => venue.isAmc);
  assert.deepEqual(amc.map((venue) => venue.id), ["amc-kabuki", "amc-metreon"]);
});
