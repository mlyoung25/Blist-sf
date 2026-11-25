import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readOrSeedCurrentListings } from "./listing-refresh.ts";
import { readCurrentListings, writeListingSnapshot } from "./listing-store.ts";
import { normalizeFeeds, type MoviesPayload, type SceneFFeed, VENUES } from "./scenef.ts";

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

function samplePayload(): MoviesPayload {
  const roxie = VENUES.find((item) => item.id === "roxie");
  assert.ok(roxie);
  const payload = normalizeFeeds([{
    venue: roxie,
    feed: feed("roxie", [{ key: "tmdb-1", title: "A Real Film", year: 2026 }], [
      screening("today", "tmdb-1", "roxie", "2026-10-16"),
    ]),
  }]);
  payload.amcExcludedMovieIds = [];
  return payload;
}

async function withFileStore(run: () => Promise<void>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "blist-seed-"));
  const keys = ["LISTING_SNAPSHOT_PATH", "POSTGRES_URL", "DATABASE_URL", "PRISMA_DATABASE_URL", "DATABASE_URL_POOLED", "POSTGRES_URL_NON_POOLING", "VERCEL"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.LISTING_SNAPSHOT_PATH = path.join(dir, "listings-snapshot.json");
  for (const key of keys) {
    if (key !== "LISTING_SNAPSHOT_PATH") delete process.env[key];
  }
  try {
    await run();
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    await rm(dir, { recursive: true, force: true });
  }
}

test("empty store seeds once then later reads skip SceneF", async () => {
  await withFileStore(async () => {
    const payload = samplePayload();
    let seedCount = 0;
    const seed = async () => {
      seedCount += 1;
      const stored = await writeListingSnapshot(payload, "2026-10-16T12:00:00.000Z");
      return { payload, kind: stored.kind, storedAt: stored.storedAt };
    };
    const first = await readOrSeedCurrentListings(new Date("2026-10-16T20:00:00Z"), seed);
    assert.equal(first.seeded, true);
    assert.equal(seedCount, 1);
    assert.equal(first.payload.movies[0].title, "A Real Film");
    const second = await readOrSeedCurrentListings(new Date("2026-10-16T20:00:00Z"), seed);
    assert.equal(second.seeded, false);
    assert.equal(seedCount, 1);
    const stored = await readCurrentListings(new Date("2026-10-16T20:00:00Z"));
    assert.ok(stored);
  });
});
