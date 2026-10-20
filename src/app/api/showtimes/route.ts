import { fetchSceneFMovies } from "@/lib/scenef";

export async function GET() {
  try {
    const payload = await fetchSceneFMovies();
    return Response.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load SceneF listings.";
    return Response.json({ error: message }, { status: 502 });
  }
}
