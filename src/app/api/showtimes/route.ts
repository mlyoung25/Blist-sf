import { fetchSceneFListings } from "@/lib/scenef";

export async function GET() {
  try {
    const payload = await fetchSceneFListings();
    return Response.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load SceneF listings.";
    return Response.json({ error: message }, { status: 502 });
  }
}
