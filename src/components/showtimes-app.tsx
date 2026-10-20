"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ExternalLink, EyeOff, Pin, Search, X } from "lucide-react";
import { movieStartDate, movieStartMonth, sortMovies } from "@/lib/movie-sort";
import {
  displayRunsForMovie,
  imdbMovieUrl,
  isAmcVenueId,
  letterboxdDirectorUrl,
  letterboxdMovieUrl,
  shouldHideAmcLinkedMovie,
  type Movie,
  type MoviesPayload,
  type TheaterRun,
} from "@/lib/scenef";

const PINNED_KEY = "blist-pinned-movies";
const LEGACY_SAVED_KEY = "blist-saved-movies";
const HIDDEN_KEY = "blist-hidden-movies";

function formatDate(date: string, includeYear = false) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: includeYear ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function formatMonth(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function movieDetails(movie: Movie) {
  return [
    movie.year,
    movie.runtimeMin ? `${movie.runtimeMin} min` : null,
    movie.rating,
  ].filter(Boolean).join(" · ");
}

function movieLanguages(movie: Movie) {
  return movie.languages.length > 0 ? movie.languages.join(", ") : "Unknown";
}

function runSummary(run: TheaterRun) {
  const dates = run.startDate === run.endDate
    ? formatDate(run.startDate)
    : `${formatDate(run.startDate)}–${formatDate(run.endDate)}`;
  const duration = `${run.durationDays} ${run.durationDays === 1 ? "day" : "days"}`;
  return `${run.venueName}: ${dates} · ${duration}${run.endsAtPublishedHorizon ? "…" : ""}`;
}

function isOneDayMovie(runs: TheaterRun[]) {
  return runs.length > 0 && runs.every((run) => run.durationDays === 1);
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

function loadStoredIds(key: string) {
  const stored = window.localStorage.getItem(key);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as string[];
  } catch {
    window.localStorage.removeItem(key);
    return [];
  }
}

export default function ShowtimesApp() {
  const [payload, setPayload] = useState<MoviesPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showAllHidden, setShowAllHidden] = useState(false);
  const [selectedVenues, setSelectedVenues] = useState<string[]>([]);
  const [oneDayOnly, setOneDayOnly] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [onFilmOnly, setOnFilmOnly] = useState(false);
  const [pinned, setPinned] = useState<string[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null);

  useEffect(() => {
    const pinnedIds = loadStoredIds(PINNED_KEY);
    const legacyIds = loadStoredIds(LEGACY_SAVED_KEY);
    const hiddenIds = loadStoredIds(HIDDEN_KEY);
    window.setTimeout(() => {
      setPinned([...new Set([...pinnedIds, ...legacyIds])]);
      setHidden(hiddenIds);
    }, 0);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/showtimes", { signal: controller.signal })
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
  }, []);

  const amcVenueSelected = selectedVenues.some((venueId) => isAmcVenueId(venueId));
  const displayOptions = useMemo(
    () => ({ showAllHidden, amcVenueSelected }),
    [amcVenueSelected, showAllHidden],
  );

  const visibleMovies = useMemo(() => {
    if (!payload) return [];
    const needle = query.trim().toLowerCase();
    const filtered = payload.movies.filter((movie) => {
        if (shouldHideAmcLinkedMovie(movie, payload, displayOptions)) return false;
        const runs = displayRunsForMovie(movie, displayOptions);
        if (runs.length === 0) return false;
        const matchesHidden = showAllHidden || !hidden.includes(movie.id);
        const matchesVenues = selectedVenues.length === 0
          || runs.some((run) => selectedVenues.includes(run.venueId));
        const oneDay = isOneDayMovie(runs);
        const matchesRun = !oneDayOnly || oneDay;
        const matchesDate = selectedDate === null
          || runs.some((run) => run.dates.some((date) => date.date === selectedDate));
        const matchesOnFilm = !onFilmOnly || movie.onFilm.matched;
        const haystack = [
          movie.title,
          movie.genres.join(" "),
          runs.map((run) => run.venueName).join(" "),
        ].join(" ").toLowerCase();
        return matchesHidden && matchesVenues && matchesRun && matchesDate && matchesOnFilm && haystack.includes(needle);
      });
    return sortMovies(filtered, selectedDate, pinned);
  }, [displayOptions, hidden, onFilmOnly, oneDayOnly, payload, pinned, query, selectedDate, selectedVenues, showAllHidden]);

  const availableDates = useMemo(() => {
    if (!payload) return [];
    return [...new Set(payload.movies.flatMap((movie) => (
      movie.runs.flatMap((run) => run.dates.map((date) => date.date))
    )))].sort();
  }, [payload]);

  const selectedMovie = payload?.movies.find((movie) => movie.id === selectedMovieId) ?? null;
  const selectedMovieRuns = selectedMovie ? displayRunsForMovie(selectedMovie, displayOptions) : [];
  const pinnedMovies = visibleMovies.filter((movie) => pinned.includes(movie.id));
  const unpinnedMovies = visibleMovies.filter((movie) => !pinned.includes(movie.id));

  const togglePinned = (id: string) => {
    const next = pinned.includes(id) ? pinned.filter((movieId) => movieId !== id) : [...pinned, id];
    setPinned(next);
    window.localStorage.setItem(PINNED_KEY, JSON.stringify(next));
  };

  const toggleHidden = (id: string) => {
    const next = hidden.includes(id) ? hidden.filter((movieId) => movieId !== id) : [...hidden, id];
    setHidden(next);
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
  };

  const toggleVenue = (id: string) => {
    setSelectedVenues((current) => current.includes(id)
      ? current.filter((venueId) => venueId !== id)
      : [...current, id]);
  };

  const renderCard = (movie: Movie) => {
    const runs = displayRunsForMovie(movie, displayOptions);
    const oneDay = isOneDayMovie(runs);
    const isPinned = pinned.includes(movie.id);
    const isHidden = hidden.includes(movie.id);
    return (
      <article
        key={movie.id}
        data-movie-id={movie.id}
        data-run-type={oneDay ? "one-day" : "multi-day"}
        data-on-film={movie.onFilm.matched ? "true" : "false"}
        className={`min-w-0 rounded-xl border-2 bg-zinc-950 p-[3px] ${
          oneDay ? "border-blue-500" : "border-white/10"
        }`}
      >
        <div
          data-card-frame
          className={`flex h-full min-w-0 flex-col overflow-hidden rounded-lg border-2 bg-zinc-900 ${
            movie.onFilm.matched ? "border-yellow-400" : "border-transparent"
          }`}
        >
        {(oneDay || movie.onFilm.matched) && (
          <span className="sr-only">
            Card status: {oneDay ? "one-day event" : ""}{oneDay && movie.onFilm.matched ? "; " : ""}
            {movie.onFilm.matched ? "verified on SceneF On Film" : ""}
          </span>
        )}
        <button
          onClick={() => setSelectedMovieId(movie.id)}
          className="group text-left"
          aria-label={`Open dates and showtimes for ${movie.title}`}
        >
          <div className="relative aspect-[2/3] bg-black">
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
        </button>

        <div className="px-4 pb-2 pt-4">
          <h2 className="text-lg font-semibold leading-tight">
            <a
              href={letterboxdMovieUrl(movie)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-start gap-1 hover:underline"
              aria-label={`${movie.title} on Letterboxd (opens in a new tab)`}
            >
              {movie.title}<ExternalLink className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            </a>
          </h2>
          {movieDetails(movie) && <p className="mt-1 text-xs text-zinc-500">{movieDetails(movie)}</p>}
          <p
            className="mt-1 text-xs text-zinc-500"
            data-language-source={movie.languageSource?.provider ?? "unknown"}
            title={movie.languageSource
              ? `${movie.languageSource.provider}: ${movie.languageSource.field}`
              : "No verified language metadata is available"}
          >
            Language: <span className="text-zinc-400">{movieLanguages(movie)}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <a
              href={imdbMovieUrl(movie)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-zinc-300 hover:text-white hover:underline"
              aria-label={`IMDb rating for ${movie.title}: ${movie.ratings.imdb?.toFixed(1) ?? "unavailable"} (opens in a new tab)`}
            >
              IMDb {movie.ratings.imdb?.toFixed(1) ?? "unavailable"}<ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </div>
        </div>

        <div className="flex flex-1 flex-col px-4 pb-4">
          <button onClick={() => setSelectedMovieId(movie.id)} className="text-left" aria-label={`View full run for ${movie.title}`}>
            <ul className="space-y-1.5 text-xs leading-5 text-zinc-400">
              {runs.map((run) => (
                <li key={run.venueId} className={run.durationDays === 1 ? "font-medium text-blue-200" : ""}>
                  {runSummary(run)}
                </li>
              ))}
            </ul>
          </button>
          <div className="mt-auto flex gap-4 pt-4 text-xs">
            <button
              onClick={() => togglePinned(movie.id)}
              className="flex items-center gap-1.5 text-zinc-500 hover:text-white"
              aria-pressed={isPinned}
              aria-label={isPinned ? `Unpin ${movie.title}` : `Pin ${movie.title}`}
            >
              <Pin className={`size-4 ${isPinned ? "fill-white text-white" : ""}`} />
              {isPinned ? "Pinned" : "Pin"}
            </button>
            <button
              onClick={() => toggleHidden(movie.id)}
              className="flex items-center gap-1.5 text-zinc-500 hover:text-white"
              aria-pressed={isHidden}
              aria-label={isHidden ? `Unhide ${movie.title}` : `Hide ${movie.title}`}
            >
              <EyeOff className="size-4" />
              {isHidden ? "Unhide" : "Hide"}
            </button>
          </div>
        </div>
        </div>
      </article>
    );
  };

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-4 text-zinc-100 md:px-8 md:py-6">
      <section className="w-full lg:mx-auto lg:w-[70vw]">
        <div data-control-bar className="grid gap-3 border-b border-white/10 pb-4 md:grid-cols-2 controls:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]">
          <label className="relative">
            <span className="sr-only">Search movies</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search movies and theaters"
              className="h-10 w-full rounded-md border border-white/10 bg-zinc-900 pl-9 pr-3 text-sm outline-none placeholder:text-zinc-600 focus:border-white/30"
            />
          </label>

          <details className="relative">
            <summary className="flex h-10 min-w-56 cursor-pointer list-none items-center rounded-md border border-white/10 bg-zinc-900 px-3 text-sm">
              {selectedVenues.length === 0 ? "All theaters" : `${selectedVenues.length} theaters`}
            </summary>
            <fieldset className="absolute right-0 z-30 mt-2 max-h-80 w-80 overflow-y-auto rounded-md border border-white/15 bg-zinc-950 p-3 shadow-2xl">
              <legend className="sr-only">Filter by theaters</legend>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">Theaters</span>
                <button type="button" onClick={() => setSelectedVenues([])} className="text-xs text-zinc-500 hover:text-white">Clear</button>
              </div>
              <div className="space-y-2">
                {payload?.venues.map((venue) => (
                  <label key={venue.id} className="flex cursor-pointer items-start gap-2 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={selectedVenues.includes(venue.id)}
                      onChange={() => toggleVenue(venue.id)}
                      className="mt-0.5 accent-white"
                    />
                    {venue.name}
                  </label>
                ))}
              </div>
            </fieldset>
          </details>

          <label
            data-filter-control="one-day"
            className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-blue-500 px-3 text-sm focus-within:ring-2 focus-within:ring-blue-500/50 ${
              oneDayOnly ? "bg-blue-500/15 text-blue-100" : "bg-zinc-900 text-zinc-200"
            }`}
          >
            <input
              type="checkbox"
              checked={oneDayOnly}
              onChange={(event) => setOneDayOnly(event.target.checked)}
              className="size-4 accent-blue-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            />
            One day only
          </label>

          <label
            data-filter-control="on-film"
            className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-yellow-400 px-3 text-sm focus-within:ring-2 focus-within:ring-yellow-400/50 ${
              onFilmOnly ? "bg-yellow-400/15 text-yellow-100" : "bg-zinc-900 text-zinc-200"
            }`}
          >
            <input
              type="checkbox"
              checked={onFilmOnly}
              onChange={(event) => setOnFilmOnly(event.target.checked)}
              className="size-4 accent-yellow-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400"
            />
            On film
          </label>

          <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-zinc-900 px-3 text-sm">
            <input
              type="checkbox"
              checked={showAllHidden}
              onChange={(event) => {
                setLoading(true);
                setError(null);
                setPayload(null);
                setShowAllHidden(event.target.checked);
              }}
              className="accent-white"
            />
            Show all hidden
          </label>
        </div>

        <nav
          aria-label="Filter showtimes by date"
          className="-mx-4 overflow-x-auto border-b border-white/10 px-4 py-2 md:-mx-8 md:px-8"
        >
          <div className="flex min-w-max gap-1.5">
            <button
              type="button"
              aria-pressed={selectedDate === null}
              onClick={() => setSelectedDate(null)}
              className={`rounded-full border px-3 py-1.5 text-xs ${
                selectedDate === null
                  ? "border-white bg-white text-zinc-950"
                  : "border-white/15 bg-zinc-900 text-zinc-400 hover:border-white/30 hover:text-white"
              }`}
            >
              All dates
            </button>
            {availableDates.map((date) => (
              <button
                type="button"
                key={date}
                aria-pressed={selectedDate === date}
                aria-label={`Show movies playing ${formatDate(date, true)}`}
                onClick={() => setSelectedDate(date)}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  selectedDate === date
                    ? "border-white bg-white text-zinc-950"
                    : "border-white/15 bg-zinc-900 text-zinc-400 hover:border-white/30 hover:text-white"
                }`}
              >
                {formatDate(date)}
              </button>
            ))}
          </div>
        </nav>

        <div className="flex min-h-12 items-center justify-between gap-4 py-3 text-xs text-zinc-500">
          <span>
            Movies{payload ? ` · ${visibleMovies.length}` : ""}
            {!showAllHidden && payload?.amcFilter.enabled ? ` · ${payload.amcFilter.excludedMovieCount} AMC titles hidden` : ""}
            {!showAllHidden && hidden.length > 0 ? ` · ${hidden.length} manually hidden` : ""}
          </span>
          <span>{pinned.length} pinned</span>
        </div>

        {error && (
          <div className="rounded-md border border-red-400/30 bg-red-950/30 p-4 text-sm text-red-200">
            SceneF could not be loaded: {error}
          </div>
        )}

        {loading && (
          <div className="py-20 text-center text-sm text-zinc-500">
            Loading live movies from SceneF…
          </div>
        )}

        {payload && visibleMovies.length === 0 && (
          <div className="py-20 text-center text-sm text-zinc-500">No movies match these filters.</div>
        )}

        <div
          data-movie-grid
          className="grid grid-cols-1 gap-4 min-[460px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 cols5:grid-cols-5 cols6:grid-cols-6"
        >
          {pinnedMovies.length > 0 && (
            <div className="col-span-full flex items-center gap-3 pt-1" data-divider="pinned">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Pinned</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
          )}
          {pinnedMovies.map(renderCard)}
          {unpinnedMovies.map((movie, index) => {
            const month = movieStartMonth(movie);
            const previousMonth = index > 0 ? movieStartMonth(unpinnedMovies[index - 1]) : null;
            return (
              <Fragment key={movie.id}>
                {month !== previousMonth && (
                  <div className="col-span-full flex items-center gap-3 pt-2" data-divider={month}>
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{formatMonth(movieStartDate(movie))}</span>
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                )}
                {renderCard(movie)}
              </Fragment>
            );
          })}
        </div>

        {payload && (
          <details className="mt-8 border-t border-white/10 py-4 text-xs text-zinc-600">
            <summary className="cursor-pointer hover:text-zinc-300">
              {payload.attribution} · published schedule through {formatDate(payload.range.end, true)} · data as of{" "}
              {payload.dataAsOf ? new Date(payload.dataAsOf).toLocaleString() : "unknown"}
            </summary>
            <p className="mt-2">
              An ellipsis means the movie reaches that theater&apos;s last published SceneF date. SceneF event filtering removed{" "}
              {payload.nonFilmFilter.excludedMovieCount} non-film or secret listings.
            </p>
            <p className="mt-2">
              On Film membership comes only from{" "}
              <a className="underline hover:text-zinc-300" href={payload.onFilmSource.sourceUrl} target="_blank" rel="noreferrer">
                SceneF&apos;s On Film page
              </a>
              {payload.onFilmSource.error
                ? `; unavailable for this refresh: ${payload.onFilmSource.error}`
                : `; ${payload.onFilmSource.matchedMovieCount} current movies matched at ${payload.onFilmSource.fetchedAt ? new Date(payload.onFilmSource.fetchedAt).toLocaleString() : "an unknown time"}.`}
            </p>
            <p className="mt-2">
              Language metadata uses{" "}
              <a className="underline hover:text-zinc-300" href={payload.languageMetadata.sourceUrl} target="_blank" rel="noreferrer">
                Wikidata {payload.languageMetadata.field}
              </a>
              {payload.languageMetadata.error
                ? `; unavailable for this refresh: ${payload.languageMetadata.error}. Unknown is shown without inference.`
                : `; ${payload.languageMetadata.matchedMovieCount} current movies have a verified language. Unknown means neither SceneF nor Wikidata supplied one.`}
            </p>
            <ul className="mt-3 space-y-1">
              {payload.sources.map((source) => (
                <li key={source.venueId}>
                  <span>{source.venueName}</span>
                  {" — "}
                  {source.error
                    ? source.error
                    : source.latestListingDate
                      ? `SceneF currently lists through ${formatDate(source.latestListingDate, true)}`
                      : "SceneF currently lists no dates"}
                  {" · "}
                  <a
                    className="inline-flex items-center gap-1 hover:text-zinc-300"
                    href={source.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${source.venueName} SceneF source (opens in a new tab)`}
                  >
                    SceneF source<ExternalLink className="size-3" aria-hidden="true" />
                  </a>
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
                <h2 id="movie-dialog-title" className="text-2xl font-semibold">
                  <a
                    className="inline-flex items-start gap-1 hover:underline"
                    href={letterboxdMovieUrl(selectedMovie)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${selectedMovie.title} on Letterboxd (opens in a new tab)`}
                  >
                    {selectedMovie.title}<ExternalLink className="mt-1 size-4 shrink-0" aria-hidden="true" />
                  </a>
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-1 text-sm text-zinc-500">
                  {selectedMovie.directors.map((director, index) => (
                    <Fragment key={director}>
                      {index > 0 && <span aria-hidden="true">,</span>}
                      <a
                        className="inline-flex items-center gap-1 hover:text-white hover:underline"
                        href={letterboxdDirectorUrl(director)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${director} on Letterboxd (opens in a new tab)`}
                      >
                        {director}<ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                    </Fragment>
                  ))}
                  {selectedMovie.directors.length > 0 && movieDetails(selectedMovie) && <span aria-hidden="true"> · </span>}
                  <span>{movieDetails(selectedMovie)}</span>
                </div>
                <p
                  className="mt-1 text-xs text-zinc-500"
                  data-language-source={selectedMovie.languageSource?.provider ?? "unknown"}
                  title={selectedMovie.languageSource
                    ? `${selectedMovie.languageSource.provider}: ${selectedMovie.languageSource.field}`
                    : "No verified language metadata is available"}
                >
                  Language: {movieLanguages(selectedMovie)}
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-400">
                  <a
                    className="inline-flex items-center gap-1 hover:text-white hover:underline"
                    href={imdbMovieUrl(selectedMovie)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${selectedMovie.title} on IMDb (opens in a new tab)`}
                  >
                    IMDb {selectedMovie.ratings.imdb?.toFixed(1) ?? "unavailable"}<ExternalLink className="size-3" aria-hidden="true" />
                  </a>
                </div>
              </div>
              <button className="rounded-md p-2 text-zinc-500 hover:bg-white/5 hover:text-white" onClick={() => setSelectedMovieId(null)} aria-label="Close movie details">
                <X className="size-5" />
              </button>
            </div>

            {selectedMovie.overview && <p className="mt-5 text-sm leading-6 text-zinc-300">{selectedMovie.overview}</p>}

            <div className="mt-6 space-y-6">
              {selectedMovieRuns.map((run) => (
                <section key={run.venueId}>
                  <div className={`flex flex-wrap items-baseline justify-between gap-2 border-b pb-2 ${
                    run.durationDays === 1 ? "border-cyan-400/50" : "border-white/10"
                  }`}>
                    <a
                      className="inline-flex items-center gap-1 font-medium hover:underline"
                      href={run.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${run.venueName} website (opens in a new tab)`}
                    >
                      {run.venueName}<ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                    <span className={run.durationDays === 1 ? "text-xs font-medium text-cyan-200" : "text-xs text-zinc-500"}>
                      {runSummary(run)}
                    </span>
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
                              {showtime.label}<ExternalLink className="ml-1 inline size-3" aria-hidden="true" />
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
