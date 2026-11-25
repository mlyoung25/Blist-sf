import { dropPastListings } from "./listing-snapshot.ts";
import { readCurrentListings, writeListingSnapshot } from "./listing-store.ts";
import { pacificCalendarDate } from "./refresh-schedule.ts";
import { fetchSceneFMovies } from "./scenef.ts";

export async function refreshListingSnapshot(now = new Date()) {
  const payload = dropPastListings(
    await fetchSceneFMovies({ fresh: true }),
    pacificCalendarDate(now),
  );
  const stored = await writeListingSnapshot(payload, now.toISOString());
  return {
    payload,
    kind: stored.kind,
    storedAt: stored.storedAt,
  };
}

/** Read the stored snapshot. If none exists, fetch SceneF once, persist, and return that seed. */
export async function readOrSeedCurrentListings(
  now = new Date(),
  seed: (when: Date) => ReturnType<typeof refreshListingSnapshot> = refreshListingSnapshot,
) {
  const existing = await readCurrentListings(now);
  if (existing) {
    return { ...existing, seeded: false as const };
  }
  const seeded = await seed(now);
  return {
    payload: seeded.payload,
    storedAt: seeded.storedAt,
    seeded: true as const,
  };
}
