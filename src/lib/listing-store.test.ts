import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { listingStoreKind, readCurrentListings, resolveListingDatabaseUrl, writeListingSnapshot } from "./listing-store.ts";
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
  const previous = {
    POSTGRES_URL: process.env.POSTGRES_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    PRISMA_DATABASE_URL: process.env.PRISMA_DATABASE_URL,
    DATABASE_URL_POOLED: process.env.DATABASE_URL_POOLED,
    POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING,
    VERCEL: process.env.VERCEL,
  };
  process.env.LISTING_SNAPSHOT_PATH = path.join(dir, "listings-snapshot.json");
  delete process.env.POSTGRES_URL;
  delete process.env.DATABASE_URL;
  delete process.env.PRISMA_DATABASE_URL;
  delete process.env.DATABASE_URL_POOLED;
  delete process.env.POSTGRES_URL_NON_POOLING;
  delete process.env.VERCEL;
  t.after(() => {
    if (previousPath === undefined) delete process.env.LISTING_SNAPSHOT_PATH;
    else process.env.LISTING_SNAPSHOT_PATH = previousPath;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
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
  const keys = ["VERCEL", "POSTGRES_URL", "DATABASE_URL", "PRISMA_DATABASE_URL", "DATABASE_URL_POOLED", "POSTGRES_URL_NON_POOLING"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.VERCEL = "1";
  for (const key of keys) {
    if (key !== "VERCEL") delete process.env[key];
  }
  try {
    assert.throws(() => listingStoreKind(), /DATABASE_URL/);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test("listing store prefers a direct postgres:// Prisma URL over prisma+postgres Accelerate", () => {
  const keys = ["DATABASE_URL", "POSTGRES_URL", "PRISMA_DATABASE_URL"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.POSTGRES_URL = "prisma+postgres://accelerate.prisma-data.net/?api_key=fake";
  process.env.DATABASE_URL = "postgres://user:pass@db.prisma.io:5432/postgres?sslmode=require";
  delete process.env.PRISMA_DATABASE_URL;
  try {
    assert.equal(
      resolveListingDatabaseUrl(),
      "postgres://user:pass@db.prisma.io:5432/postgres?sslmode=require",
    );
    assert.equal(listingStoreKind(), "postgres");
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test("listing store rejects Accelerate-only URLs instead of calling Neon HTTP", () => {
  const keys = ["DATABASE_URL", "POSTGRES_URL", "PRISMA_DATABASE_URL", "POSTGRES_URL_NON_POOLING"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.POSTGRES_URL = "prisma+postgres://accelerate.prisma-data.net/?api_key=fake";
  delete process.env.DATABASE_URL;
  delete process.env.PRISMA_DATABASE_URL;
  delete process.env.POSTGRES_URL_NON_POOLING;
  try {
    assert.throws(() => resolveListingDatabaseUrl(), /prisma\+postgres/);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
