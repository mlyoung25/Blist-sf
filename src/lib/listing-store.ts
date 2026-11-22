import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { dropPastListings } from "./listing-snapshot.ts";
import { pacificCalendarDate } from "./refresh-schedule.ts";
import type { MoviesPayload } from "./scenef.ts";

export const LISTING_SNAPSHOT_ID = "current";
export const DEFAULT_FILE_SNAPSHOT_PATH = path.join(process.cwd(), ".data", "listings-snapshot.json");

export type ListingStoreKind = "postgres" | "file";

export type StoredListingSnapshot = {
  storedAt: string;
  payload: MoviesPayload;
};

function postgresUrl() {
  return process.env.POSTGRES_URL
    ?? process.env.DATABASE_URL
    ?? process.env.POSTGRES_URL_NON_POOLING
    ?? null;
}

export function listingStoreKind(): ListingStoreKind {
  if (postgresUrl()) return "postgres";
  if (process.env.VERCEL) {
    throw new Error("POSTGRES_URL (or DATABASE_URL) is required on Vercel so listings persist across serverless invocations.");
  }
  return "file";
}

function fileSnapshotPath() {
  return process.env.LISTING_SNAPSHOT_PATH ?? DEFAULT_FILE_SNAPSHOT_PATH;
}

async function withPostgres<T>(run: (sql: ReturnType<typeof neon>) => Promise<T>) {
  const url = postgresUrl();
  if (!url) throw new Error("Postgres is not configured.");
  return run(neon(url));
}

async function ensureSnapshotTable(sql: ReturnType<typeof neon>) {
  await sql`
    CREATE TABLE IF NOT EXISTS listing_snapshots (
      id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      stored_at TIMESTAMPTZ NOT NULL
    )
  `;
}

async function readFileSnapshot(): Promise<StoredListingSnapshot | null> {
  try {
    const raw = await readFile(fileSnapshotPath(), "utf8");
    const parsed = JSON.parse(raw) as StoredListingSnapshot;
    if (!parsed?.payload || !parsed.storedAt) return null;
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeFileSnapshot(snapshot: StoredListingSnapshot) {
  const target = fileSnapshotPath();
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

export async function writeListingSnapshot(payload: MoviesPayload, storedAt = new Date().toISOString()) {
  const snapshot: StoredListingSnapshot = { storedAt, payload };
  const kind = listingStoreKind();
  if (kind === "file") {
    await writeFileSnapshot(snapshot);
    return { kind, storedAt };
  }

  await withPostgres(async (sql) => {
    await ensureSnapshotTable(sql);
    await sql`
      INSERT INTO listing_snapshots (id, payload, stored_at)
      VALUES (${LISTING_SNAPSHOT_ID}, ${JSON.stringify(payload)}, ${storedAt})
      ON CONFLICT (id) DO UPDATE SET
        payload = EXCLUDED.payload,
        stored_at = EXCLUDED.stored_at
    `;
  });
  return { kind, storedAt };
}

export async function readListingSnapshot(): Promise<StoredListingSnapshot | null> {
  const kind = listingStoreKind();
  if (kind === "file") return readFileSnapshot();

  const rows = await withPostgres(async (sql) => {
    await ensureSnapshotTable(sql);
    return sql`
      SELECT payload, stored_at
      FROM listing_snapshots
      WHERE id = ${LISTING_SNAPSHOT_ID}
      LIMIT 1
    ` as unknown as Promise<{ payload: MoviesPayload; stored_at: string }[]>;
  });
  const row = rows[0];
  if (!row?.payload || !row.stored_at) return null;
  return {
    storedAt: typeof row.stored_at === "string" ? row.stored_at : new Date(row.stored_at).toISOString(),
    payload: row.payload,
  };
}

export async function readCurrentListings(now = new Date()) {
  const snapshot = await readListingSnapshot();
  if (!snapshot) return null;
  return {
    ...snapshot,
    payload: dropPastListings(snapshot.payload, pacificCalendarDate(now)),
  };
}
