"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Heart, Search, X } from "lucide-react";
import type { Movie, MoviesPayload, TheaterRun } from "@/lib/scenef";

const ALL_VENUES = "all";
const SAVED_KEY = "blist-saved-movies";

function formatDate(date: string, includeYear = false) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: includeYear ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function movieDetails(movie: Movie) {
  return [
    movie.directors.join(", "),
    movie.year,
    movie.runtimeMin ? `${movie.runtimeMin} min` : null,
    movie.rating,
  ].filter(Boolean).join(" · ");
}

function runSummary(run: TheaterRun) {
  const dates = run.startDate === run.endDate
    ? formatDate(run.startDate)
    : `${formatDate(run.startDate)}–${formatDate(run.endDate)}`;
  const duration = `${run.durationDays} ${run.durationDays === 1 ? "day" : "days"}`;
  return `${run.venueName}: ${dates} · ${duration}${run.endsAtPublishedHorizon ? "…" : ""}`;
}

function needsConfirmation(run: TheaterRun) {
  const freshness = run.freshness;
  return run.confidence === "disputed"
    || (freshness !== null && (
      freshness.status !== "current"
      || freshness.retained === true
      || (freshness.source_status !== undefined && freshness.source_status !== "ok")
    ));
}

export default function ShowtimesApp({ savedOnly = false }: { savedOnly?: boolean }) {
  const [payload, setPayload] = useState<MoviesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVenue, setSelectedVenue] = useState(ALL_VENUES);
  const [query, setQuery] = useState("");
  const [excludeAmc, setExcludeAmc] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(SAVED_KEY);
    if (!stored) return;
    try {
      const savedIds = JSON.parse(stored) as string[];
      window.setTimeout(() => setSaved(savedIds), 0);
    } catch {
      window.localStorage.removeItem(SAVED_KEY);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/showtimes${excludeAmc ? "?excludeAmc=1" : ""}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as MoviesPayload | { error?: string };
        if (!response.ok || !("movies" in data)) {
          throw new Error("error" in data ? data.error : "Unable to load movies.");
        }
        setPayload(data);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load movies.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [excludeAmc]);

  const visibleMovies = useMemo(() => {
    if (!payload) return [];
    const needle = query.trim().toLowerCase();
    return payload.movies.filter((movie) => {
      const matchesSaved = !savedOnly || saved.includes(movie.id);
      const matchesVenue = selectedVenue === ALL_VENUES || movie.runs.some((run) => run.venueId === selectedVenue);
      const haystack = [
        movie.title,
        movie.directors.join(" "),
        movie.genres.join(" "),
        movie.runs.map((run) => run.venueName).join(" "),
      ].join(" ").toLowerCase();
      return matchesSaved && matchesVenue && haystack.includes(needle);
    });
  }, [payload, query, saved, savedOnly, selectedVenue]);

  const selectedMovie = payload?.movies.find((movie) => movie.id === selectedMovieId) ?? null;

  const toggleSaved = (id: string) => {
    const next = saved.includes(id) ? saved.filter((savedId) => savedId !== id) : [...saved, id];
    setSaved(next);
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  };

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-4 text-zinc-100 md:px-8 md:py-6">
      <section className="mx-auto max-w-7xl">
        <div className="grid gap-3 border-b border-white/10 pb-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <label className="relative">
            <span className="sr-only">Search movies</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search movies, directors, theaters"
              className="h-10 w-full rounded-md border border-white/10 bg-zinc-900 pl-9 pr-3 text-sm outline-none placeholder:text-zinc-600 focus:border-white/30"
            />
          </label>

          <label>
            <span className="sr-only">Filter by theater</span>
            <select
              value={selectedVenue}
              onChange={(event) => setSelectedVenue(event.target.value)}
              className="h-10 w-full rounded-md border border-white/10 bg-zinc-900 px-3 text-sm outline-none focus:border-white/30 md:w-72"
            >
              <option value={ALL_VENUES}>All theaters</option>
              {payload?.venues.map((venue) => (
                <option key={venue.id} value={venue.id}>{venue.name}</option>
              ))}
            </select>
          </label>

          <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-zinc-900 px-3 text-sm">
            <input
              type="checkbox"
              checked={excludeAmc}
              onChange={(event) => {
                setLoading(true);
                setError(null);
                setPayload(null);
                setExcludeAmc(event.target.checked);
              }}
              className="accent-white"
            />
            Hide movies at AMC
          </label>
        </div>

        <div className="flex min-h-12 items-center justify-between gap-4 py-3 text-xs text-zinc-500">
          <span>
            {savedOnly ? "Saved movies" : "Movies"}
            {payload ? ` · ${visibleMovies.length}` : ""}
            {payload?.amcFilter.enabled ? ` · ${payload.amcFilter.excludedMovieCount} AMC ${payload.amcFilter.excludedMovieCount === 1 ? "match" : "matches"} hidden` : ""}
          </span>
          <Link className="hover:text-white" href={savedOnly ? "/" : "/saved"}>
            {savedOnly ? "All movies" : `Saved (${saved.length})`}
          </Link>
        </div>

        {error && (
          <div className="rounded-md border border-red-400/30 bg-red-950/30 p-4 text-sm text-red-200">
            SceneF could not be loaded: {error}
          </div>
        )}

        {loading && (
          <div className="py-20 text-center text-sm text-zinc-500">
            {excludeAmc ? "Checking SceneF’s AMC schedules…" : "Loading live movies from SceneF…"}
          </div>
        )}

        {payload && visibleMovies.length === 0 && (
          <div className="py-20 text-center text-sm text-zinc-500">
            {savedOnly ? "No saved movies match these filters." : "SceneF has no movies matching these filters."}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 min-[460px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {visibleMovies.map((movie) => (
            <article key={movie.id} className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
              <button
                onClick={() => setSelectedMovieId(movie.id)}
                className="group text-left"
                aria-label={`Open dates and showtimes for ${movie.title}`}
              >
                <div className="aspect-[2/3] bg-black">
                  {movie.posterUrl ? (
                    <div
                      role="img"
                      aria-label={`${movie.title} poster`}
                      className="size-full bg-contain bg-center bg-no-repeat transition duration-300 group-hover:scale-[1.015]"
                      style={{ backgroundImage: `url("${movie.posterUrl}")` }}
                    />
                  ) : (
                    <div className="grid size-full place-items-center px-6 text-center text-sm text-zinc-600">Poster unavailable from SceneF</div>
                  )}
                </div>
                <div className="p-4 pb-2">
                  <h2 className="text-lg font-semibold leading-tight group-hover:text-white">{movie.title}</h2>
                  {movieDetails(movie) && <p className="mt-1 text-xs text-zinc-500">{movieDetails(movie)}</p>}
                </div>
              </button>

              <div className="flex flex-1 flex-col px-4 pb-4">
                <button onClick={() => setSelectedMovieId(movie.id)} className="text-left" aria-label={`View full run for ${movie.title}`}>
                  <ul className="space-y-1.5 text-xs leading-5 text-zinc-400">
                    {movie.runs.map((run) => <li key={run.venueId}>{runSummary(run)}</li>)}
                  </ul>
                </button>
                <button
                  onClick={() => toggleSaved(movie.id)}
                  className="mt-auto flex items-center gap-1.5 pt-4 text-xs text-zinc-500 hover:text-white"
                  aria-label={saved.includes(movie.id) ? `Remove ${movie.title} from saved` : `Save ${movie.title}`}
                >
                  <Heart className={`size-4 ${saved.includes(movie.id) ? "fill-white text-white" : ""}`} />
                  {saved.includes(movie.id) ? "Saved" : "Save"}
                </button>
              </div>
            </article>
          ))}
        </div>

        {payload && (
          <details className="mt-8 border-t border-white/10 py-4 text-xs text-zinc-600">
            <summary className="cursor-pointer hover:text-zinc-300">
              {payload.attribution} · published schedule through {formatDate(payload.range.end, true)} · data as of{" "}
              {payload.dataAsOf ? new Date(payload.dataAsOf).toLocaleString() : "unknown"}
            </summary>
            <p className="mt-2">An ellipsis after a theater run means the movie reaches that theater&apos;s last currently published SceneF date.</p>
            <ul className="mt-3 space-y-1">
              {payload.sources.map((source) => (
                <li key={source.venueId}>
                  <a className="hover:text-zinc-300" href={source.sourceUrl} target="_blank" rel="noreferrer">
                    {source.venueName}
                  </a>
                  {" — "}
                  {source.error
                    ? source.error
                    : source.latestListingDate
                      ? `SceneF currently lists through ${formatDate(source.latestListingDate, true)}`
                      : "SceneF currently lists no dates"}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {selectedMovie && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={() => setSelectedMovieId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="movie-dialog-title"
            className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-t-xl border border-white/10 bg-zinc-950 p-5 shadow-2xl sm:rounded-xl sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <h2 id="movie-dialog-title" className="text-2xl font-semibold">{selectedMovie.title}</h2>
                {movieDetails(selectedMovie) && <p className="mt-1 text-sm text-zinc-500">{movieDetails(selectedMovie)}</p>}
              </div>
              <button className="rounded-md p-2 text-zinc-500 hover:bg-white/5 hover:text-white" onClick={() => setSelectedMovieId(null)} aria-label="Close movie details">
                <X className="size-5" />
              </button>
            </div>

            {selectedMovie.overview && <p className="mt-5 text-sm leading-6 text-zinc-300">{selectedMovie.overview}</p>}

            <div className="mt-6 space-y-6">
              {selectedMovie.runs.map((run) => (
                <section key={run.venueId}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 pb-2">
                    <a className="inline-flex items-center gap-1 font-medium hover:text-white" href={run.sourceUrl} target="_blank" rel="noreferrer">
                      {run.venueName}<ExternalLink className="size-3.5" />
                    </a>
                    <span className="text-xs text-zinc-500">{runSummary(run)}</span>
                  </div>
                  {needsConfirmation(run) && (
                    <p className="mt-2 text-xs text-amber-300">
                      Confirm with the theater{run.note ? ` — ${run.note}` : ""}
                    </p>
                  )}
                  <div className="mt-3 space-y-3">
                    {run.dates.map((date) => (
                      <div key={date.date} className="grid gap-2 sm:grid-cols-[8rem_1fr] sm:items-start">
                        <span className="text-sm text-zinc-400">{formatDate(date.date, true)}</span>
                        <div className="flex flex-wrap gap-2">
                          {date.showtimes.map((showtime) => (
                            <a
                              key={showtime.id}
                              href={showtime.ticketUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md border border-white/15 px-2.5 py-1.5 text-xs font-medium hover:border-white/40 hover:bg-white hover:text-black"
                            >
                              {showtime.label}
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
