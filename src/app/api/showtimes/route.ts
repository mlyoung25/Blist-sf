import { fetchSceneFMovies } from "@/lib/scenef";

export async function GET(request: Request) {
  try {
    const excludeAmc = new URL(request.url).searchParams.get("excludeAmc") === "1";
    const payload = await fetchSceneFMovies({ excludeAmc });
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
