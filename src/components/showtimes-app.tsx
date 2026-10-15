"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Heart, Search } from "lucide-react";
import type { Listing, ListingsPayload } from "@/lib/scenef";

const ALL_VENUES = "all";
const SAVED_KEY = "blist-saved-screenings";

function formatDate(date: string, long = false) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: long ? "long" : "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function movieDetails(listing: Listing) {
  return [
    listing.directors.join(", "),
    listing.year,
    listing.runtimeMin ? `${listing.runtimeMin} min` : null,
    listing.rating,
  ].filter(Boolean).join(" · ");
}

function needsConfirmation(listing: Listing) {
  const freshness = listing.freshness;
  return listing.confidence === "disputed"
    || (freshness !== null && freshness !== undefined && (
      freshness.status !== "current"
      || freshness.retained === true
      || (freshness.source_status !== undefined && freshness.source_status !== "ok")
    ));
}

export default function ShowtimesApp({ savedOnly = false }: { savedOnly?: boolean }) {
  const [payload, setPayload] = useState<ListingsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedVenue, setSelectedVenue] = useState(ALL_VENUES);
  const [query, setQuery] = useState("");
  const [includeAmc, setIncludeAmc] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => {
    const stored = window.localStorage.getItem(SAVED_KEY);
    if (stored) {
      try {
        const savedIds = JSON.parse(stored) as string[];
        window.setTimeout(() => setSaved(savedIds), 0);
      } catch {
        window.localStorage.removeItem(SAVED_KEY);
      }
    }

    const controller = new AbortController();
    fetch("/api/showtimes", { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as ListingsPayload | { error?: string };
        if (!response.ok || !("listings" in data)) {
          throw new Error("error" in data ? data.error : "Unable to load showtimes.");
        }
        setPayload(data);
        setSelectedDate(data.range.start);
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Unable to load showtimes.");
      });

    return () => controller.abort();
  }, []);

  const dates = useMemo(() => {
    if (!payload) return [];
    return Array.from({ length: payload.range.days }, (_, index) => {
      const date = new Date(`${payload.range.start}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + index);
      return date.toISOString().slice(0, 10);
    });
  }, [payload]);

  const visibleVenues = useMemo(
    () => payload?.venues.filter((venue) => includeAmc || !venue.isAmc) ?? [],
    [includeAmc, payload],
  );

  const visibleListings = useMemo(() => {
    if (!payload) return [];
    const needle = query.trim().toLowerCase();
    return payload.listings.filter((listing) => {
      const matchesSaved = !savedOnly || saved.includes(listing.id);
      const matchesDate = savedOnly || listing.date === selectedDate;
      const matchesAmc = includeAmc || !listing.isAmc;
      const matchesVenue = selectedVenue === ALL_VENUES || listing.venueId === selectedVenue;
      const haystack = [
        listing.title,
        listing.directors.join(" "),
        listing.venueName,
        listing.genres.join(" "),
      ].join(" ").toLowerCase();
      return matchesSaved && matchesDate && matchesAmc && matchesVenue && haystack.includes(needle);
    });
  }, [includeAmc, payload, query, saved, savedOnly, selectedDate, selectedVenue]);

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
            <span className="sr-only">Search showtimes</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search films, directors, theaters"
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
              {visibleVenues.map((venue) => (
                <option key={venue.id} value={venue.id}>{venue.name}</option>
              ))}
            </select>
          </label>

          <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-white/10 bg-zinc-900 px-3 text-sm">
            <input
              type="checkbox"
              checked={includeAmc}
              onChange={(event) => {
                const checked = event.target.checked;
                setIncludeAmc(checked);
                if (!checked && selectedVenue.startsWith("amc-")) setSelectedVenue(ALL_VENUES);
              }}
              className="accent-white"
            />
            Include AMC
          </label>
        </div>

        {!savedOnly && (
          <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-white/10 py-3" aria-label="Choose a date">
            {dates.map((date) => (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={`shrink-0 rounded-md px-3 py-2 text-left text-xs transition ${
                  selectedDate === date ? "bg-white text-black" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {formatDate(date)}
              </button>
            ))}
          </div>
        )}

        <div className="flex min-h-12 items-center justify-between gap-4 py-3 text-xs text-zinc-500">
          <span>
            {savedOnly ? "Saved screenings" : selectedDate ? formatDate(selectedDate, true) : "Loading dates"}
            {payload ? ` · ${visibleListings.length} ${visibleListings.length === 1 ? "film" : "films"}` : ""}
          </span>
          <Link className="hover:text-white" href={savedOnly ? "/" : "/saved"}>
            {savedOnly ? "All showtimes" : `Saved (${saved.length})`}
          </Link>
        </div>

        {error && (
          <div className="rounded-md border border-red-400/30 bg-red-950/30 p-4 text-sm text-red-200">
            SceneF could not be loaded: {error}
          </div>
        )}

        {!payload && !error && (
          <div className="py-20 text-center text-sm text-zinc-500">Loading live showtimes from SceneF…</div>
        )}

        {payload && visibleListings.length === 0 && (
          <div className="py-20 text-center text-sm text-zinc-500">
            {savedOnly ? "No saved screenings match these filters." : "SceneF has no listings matching these filters."}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleListings.map((listing) => (
            <article key={listing.id} className="overflow-hidden rounded-lg border border-white/10 bg-zinc-900">
              {listing.posterUrl && (
                <div
                  role="img"
                  aria-label=""
                  className="aspect-[16/7] bg-zinc-800 bg-cover bg-center"
                  style={{ backgroundImage: `linear-gradient(to top, rgb(24 24 27), transparent 60%), url("${listing.posterUrl}")` }}
                />
              )}
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold leading-tight">{listing.title}</h2>
                    {movieDetails(listing) && <p className="mt-1 text-xs text-zinc-500">{movieDetails(listing)}</p>}
                  </div>
                  <button
                    onClick={() => toggleSaved(listing.id)}
                    className="rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-white"
                    aria-label={saved.includes(listing.id) ? `Remove ${listing.title} from saved` : `Save ${listing.title}`}
                  >
                    <Heart className={`size-4 ${saved.includes(listing.id) ? "fill-white text-white" : ""}`} />
                  </button>
                </div>

                <a
                  href={listing.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
                >
                  {listing.venueName}<ExternalLink className="size-3" />
                </a>
                {needsConfirmation(listing) && (
                  <p className="mt-2 text-xs text-amber-300">
                    Confirm with the theater{listing.note ? ` — ${listing.note}` : ""}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {listing.showtimes.map((showtime) => (
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
            </article>
          ))}
        </div>

        {payload && (
          <details className="mt-8 border-t border-white/10 py-4 text-xs text-zinc-600">
            <summary className="cursor-pointer hover:text-zinc-300">
              {payload.attribution} · {payload.range.days}-day window · data as of{" "}
              {payload.dataAsOf ? new Date(payload.dataAsOf).toLocaleString() : "unknown"}
            </summary>
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
                      ? `SceneF currently lists through ${formatDate(source.latestListingDate, true)}${source.reachesWindowEnd ? "" : " (short of this app’s 14-day window)"}`
                      : "SceneF currently lists no dates"}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </main>
  );
}
