import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultClientConfig, prismaPostgres } from "@prisma/ppg";
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

const PRISMA_DIRECT_HINT = "Set DATABASE_URL to the direct Prisma Postgres URL from Prisma Console → Connect: postgres://USER:PASSWORD@db.prisma.io:5432/postgres?sslmode=require. The Neon HTTP client cannot use prisma+postgres:// Accelerate URLs.";

function envCandidates() {
  return [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.PRISMA_DATABASE_URL,
    process.env.POSTGRES_URL_NON_POOLING,
  ].filter((value): value is string => Boolean(value));
}

function isPostgresTcpUrl(url: string) {
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

function isPrismaAccelerateUrl(url: string) {
  return url.startsWith("prisma+postgres://") || url.startsWith("prisma://");
}

/** Direct `postgres://…@db.prisma.io` string for `@prisma/ppg`. Never Neon HTTP or Accelerate. */
export function resolveListingDatabaseUrl() {
  const candidates = envCandidates();
  const tcpUrl = candidates.find(isPostgresTcpUrl);
  if (tcpUrl) return tcpUrl;
  if (candidates.some(isPrismaAccelerateUrl)) {
    throw new Error(`Listing store received a Prisma Accelerate URL (prisma+postgres://). ${PRISMA_DIRECT_HINT}`);
  }
  return null;
}

export function listingStoreKind(): ListingStoreKind {
  if (resolveListingDatabaseUrl()) return "postgres";
  if (process.env.VERCEL) {
    throw new Error(`DATABASE_URL (direct postgres:// to db.prisma.io) is required on Vercel. ${PRISMA_DIRECT_HINT}`);
  }
  return "file";
}

function fileSnapshotPath() {
  return process.env.LISTING_SNAPSHOT_PATH ?? DEFAULT_FILE_SNAPSHOT_PATH;
}

function listingClient() {
  const url = resolveListingDatabaseUrl();
  if (!url) throw new Error("Prisma Postgres is not configured.");
  return prismaPostgres(defaultClientConfig(url));
}

async function ensureSnapshotTable() {
  const ppg = listingClient();
  await ppg.sql.exec`
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

function listingStoreError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/resource-not-found|GET \/v1\/\{resource\}/i.test(message)) {
    return new Error(
      `Listing store is not SceneF: Prisma Postgres rejected a Neon-style HTTP request. ${PRISMA_DIRECT_HINT} Original error: ${message}`,
    );
  }
  return new Error(`Listing store failed: ${message}`);
}

export async function writeListingSnapshot(payload: MoviesPayload, storedAt = new Date().toISOString()) {
  const snapshot: StoredListingSnapshot = { storedAt, payload };
  const kind = listingStoreKind();
  if (kind === "file") {
    await writeFileSnapshot(snapshot);
    return { kind, storedAt };
  }

  try {
    await ensureSnapshotTable();
    const ppg = listingClient();
    await ppg.sql.exec`
      INSERT INTO listing_snapshots (id, payload, stored_at)
      VALUES (${LISTING_SNAPSHOT_ID}, ${JSON.stringify(payload)}::jsonb, ${storedAt}::timestamptz)
      ON CONFLICT (id) DO UPDATE SET
        payload = EXCLUDED.payload,
        stored_at = EXCLUDED.stored_at
    `;
  } catch (error) {
    throw listingStoreError(error);
  }
  return { kind, storedAt };
}

export async function readListingSnapshot(): Promise<StoredListingSnapshot | null> {
  const kind = listingStoreKind();
  if (kind === "file") return readFileSnapshot();

  try {
    await ensureSnapshotTable();
    const ppg = listingClient();
    const rows = await ppg.sql<{ payload: MoviesPayload; stored_at: string | Date }>`
      SELECT payload, stored_at
      FROM listing_snapshots
      WHERE id = ${LISTING_SNAPSHOT_ID}
      LIMIT 1
    `.collect();
    const row = rows[0];
    if (!row?.payload || !row.stored_at) return null;
    return {
      storedAt: typeof row.stored_at === "string" ? row.stored_at : new Date(row.stored_at).toISOString(),
      payload: row.payload,
    };
  } catch (error) {
    throw listingStoreError(error);
  }
}

export async function readCurrentListings(now = new Date()) {
  const snapshot = await readListingSnapshot();
  if (!snapshot) return null;
  return {
    ...snapshot,
    payload: dropPastListings(snapshot.payload, pacificCalendarDate(now)),
  };
}
