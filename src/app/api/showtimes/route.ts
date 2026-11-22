import { connection } from "next/server";
import { readCurrentListings } from "@/lib/listing-store";

export async function GET() {
  await connection();
  try {
    const snapshot = await readCurrentListings();
    if (!snapshot) {
      return Response.json(
        { error: "No listing snapshot is stored yet. Run the scheduled /api/refresh job." },
        { status: 503 },
      );
    }
    return Response.json(snapshot.payload, {
      headers: {
        "Cache-Control": "no-store",
        "X-Listing-Stored-At": snapshot.storedAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load stored listings.";
    return Response.json({ error: message }, { status: 502 });
  }
}
