import { connection } from "next/server";
import { readOrSeedCurrentListings } from "@/lib/listing-refresh";

export const maxDuration = 60;

export async function GET() {
  await connection();
  try {
    const snapshot = await readOrSeedCurrentListings();
    return Response.json(snapshot.payload, {
      headers: {
        "Cache-Control": "no-store",
        "X-Listing-Stored-At": snapshot.storedAt,
        "X-Listing-Seeded": snapshot.seeded ? "1" : "0",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load stored listings.";
    return Response.json({ error: message }, { status: 502 });
  }
}
