import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { listingStoreKind, readCurrentListings, writeListingSnapshot } from "./listing-store.ts";
import { normalizeFeeds, type SceneFFeed, VENUES } from "./scenef.ts";

function screening(id: string, filmKey: string, venueId: string, nightOf: string) {
  return {
    id,
    filmKey,
    venueId,
    startsAt: `${nightOf}T18:00:00-07:00`,
    nightOf,
    ticketUrl: `https://scenef.com/go/${id}`,
  };
}

function feed(venueId: string, films: SceneFFeed["films"], screenings: SceneFFeed["screenings"]): SceneFFeed {
  return {
    attribution: "Showtimes via SceneF.com",
    data_as_of: "2026-10-16T08:00:00Z",
    tonight_is: { night: "2026-10-15" },
    films,
    screenings: screenings.map((item) => ({ ...item, venueId })),
  };
}

test("file store persists a full snapshot and reads it without SceneF", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "blist-listings-"));
  const previousPath = process.env.LISTING_SNAPSHOT_PATH;
  const previousPostgres = process.env.POSTGRES_URL;
  const previousDatabase = process.env.DATABASE_URL;
  const previousVercel = process.env.VERCEL;
  process.env.LISTING_SNAPSHOT_PATH = path.join(dir, "listings-snapshot.json");
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL;
  delete process.env.VERCEL;
  t.after(() => {
    if (previousPath === undefined) delete process.env.LISTING_SNAPSHOT_PATH;
    else process.env.LISTING_SNAPSHOT_PATH = previousPath;
    if (previousPostgres === undefined) delete process.env.POSTGRES_URL;
    else process.env.POSTGRES_URL = previousPostgres;
    if (previousDatabase === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabase;
    if (previousVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousVercel;
    return rm(dir, { recursive: true, force: true });
  });

  assert.equal(listingStoreKind(), "file");
  const roxie = VENUES.find((item) => item.id === "roxie");
  assert.ok(roxie);
  const payload = normalizeFeeds([{
    venue: roxie,
    feed: feed("roxie", [{ key: "tmdb-1", title: "A Real Film", year: 2026 }], [
      screening("past", "tmdb-1", "roxie", "2026-10-14"),
      screening("today", "tmdb-1", "roxie", "2026-10-16"),
    ]),
  }]);
  payload.amcExcludedMovieIds = [];

  const written = await writeListingSnapshot(payload, "2026-10-16T12:00:00.000Z");
  assert.equal(written.kind, "file");
  const stored = await readCurrentListings(new Date("2026-10-16T20:00:00Z"));
  assert.ok(stored);
  assert.equal(stored.storedAt, "2026-10-16T12:00:00.000Z");
  assert.deepEqual(stored.payload.movies[0].runs[0].dates.map((entry) => entry.date), ["2026-10-16"]);
});

test("vercel deployments refuse the file fallback", () => {
  const previousVercel = process.env.VERCEL;
  const previousPostgres = process.env.POSTGRES_URL;
  const previousDatabase = process.env.DATABASE_URL;
  process.env.VERCEL = "1";
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL;
  try {
    assert.throws(() => listingStoreKind(), /POSTGRES_URL/);
  } finally {
    if (previousVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousVercel;
    if (previousPostgres === undefined) delete process.env.POSTGRES_URL;
    else process.env.POSTGRES_URL = previousPostgres;
    if (previousDatabase === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabase;
  }
});
