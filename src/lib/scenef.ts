export const SCENEF_BASE_URL = "https://scenef.com";
export const WINDOW_DAYS = 14;

export type VenueConfig = {
  id: string;
  name: string;
  isAmc: boolean;
};

export const VENUES: readonly VenueConfig[] = [
  { id: "4star", name: "4 Star Theatre", isAmc: false },
  { id: "alamo-new-mission", name: "Alamo Drafthouse", isAmc: false },
  { id: "apple-van-ness", name: "Apple Cinemas Van Ness IMAX", isAmc: false },
  { id: "balboa", name: "Balboa Theatre", isAmc: false },
  { id: "castro", name: "Castro Theatre", isAmc: false },
  { id: "opera-plaza", name: "Landmark Opera Plaza Cinema", isAmc: false },
  { id: "marina", name: "Marina Theatre", isAmc: false },
  { id: "presidio", name: "Presidio Theatre", isAmc: false },
  { id: "regal-stonestown", name: "Regal Stonestown Galleria 12", isAmc: false },
  { id: "roxie", name: "Roxie Theatre", isAmc: false },
  { id: "vogue", name: "Vogue Theatre", isAmc: false },
  { id: "amc-kabuki", name: "AMC Kabuki 8", isAmc: true },
  { id: "amc-metreon", name: "AMC Metreon 16", isAmc: true },
] as const;

type SceneFFilm = {
  key: string;
  title: string;
  year?: number;
  runtimeMin?: number;
  mpaa?: string;
  genres?: string[];
  overview?: string;
  directors?: string[];
  posterUrl?: string;
};

type SceneFScreening = {
  id: string;
  filmKey: string;
  venueId: string;
  startsAt: string;
  nightOf: string;
  tags?: string[];
  ticketUrl: string;
  confidence?: string;
  source_tier?: string;
  verified_at?: string;
  freshness?: {
    status?: string;
    age_hours?: number;
    retained?: boolean;
    source_status?: string;
  };
  note?: string;
};

export type SceneFFeed = {
  attribution: string;
  data_as_of: string;
  tonight_is: { night: string };
  films: SceneFFilm[];
  screenings: SceneFScreening[];
};

export type Showtime = {
  id: string;
  startsAt: string;
  label: string;
  ticketUrl: string;
};

export type Listing = {
  id: string;
  filmKey: string;
  title: string;
  directors: string[];
  year: number | null;
  runtimeMin: number | null;
  rating: string | null;
  genres: string[];
  overview: string | null;
  posterUrl: string | null;
  venueId: string;
  venueName: string;
  isAmc: boolean;
  date: string;
  showtimes: Showtime[];
  tags: string[];
  sourceUrl: string;
  sourceTier: string | null;
  confidence: string | null;
  verifiedAt: string | null;
  freshness: SceneFScreening["freshness"] | null;
  note: string | null;
};

export type SourceStatus = {
  venueId: string;
  venueName: string;
  sourceUrl: string;
  latestListingDate: string | null;
  reachesWindowEnd: boolean;
  error?: string;
};

export type ListingsPayload = {
  attribution: "Showtimes via SceneF.com";
  dataAsOf: string | null;
  range: { start: string; end: string; days: number };
  venues: VenueConfig[];
  listings: Listing[];
  sources: SourceStatus[];
};

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function timeLabel(startsAt: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  }).format(new Date(startsAt));
}

export function normalizeFeeds(
  feeds: Array<{ venue: VenueConfig; feed: SceneFFeed }>,
  days = WINDOW_DAYS,
): ListingsPayload {
  const start = feeds
    .map(({ feed }) => feed.tonight_is.night)
    .sort()
    .at(-1);

  if (!start) {
    throw new Error("SceneF returned no calendar start date.");
  }

  const end = addDays(start, days - 1);
  const attribution = feeds[0]?.feed.attribution;
  if (attribution !== "Showtimes via SceneF.com") {
    throw new Error("SceneF returned an unexpected or missing attribution.");
  }
  const listings = new Map<string, Listing>();
  const sources: SourceStatus[] = [];

  for (const { venue, feed } of feeds) {
    const films = new Map(feed.films.map((film) => [film.key, film]));
    const latestListingDate = feed.screenings
      .map((screening) => screening.nightOf)
      .sort()
      .at(-1) ?? null;

    sources.push({
      venueId: venue.id,
      venueName: venue.name,
      sourceUrl: `${SCENEF_BASE_URL}/theater/${venue.id}`,
      latestListingDate,
      reachesWindowEnd: latestListingDate !== null && latestListingDate >= end,
    });

    for (const screening of feed.screenings) {
      if (screening.nightOf < start || screening.nightOf > end) continue;

      const film = films.get(screening.filmKey);
      if (!film) continue;

      const key = `${screening.nightOf}:${venue.id}:${screening.filmKey}`;
      const existing = listings.get(key);
      const showtime = {
        id: screening.id,
        startsAt: screening.startsAt,
        label: timeLabel(screening.startsAt),
        ticketUrl: screening.ticketUrl,
      };

      if (existing) {
        existing.showtimes.push(showtime);
        existing.tags = [...new Set([...existing.tags, ...(screening.tags ?? [])])];
        if (screening.freshness?.status !== "current") {
          existing.freshness = screening.freshness ?? existing.freshness;
        }
        if (screening.confidence === "disputed") existing.confidence = screening.confidence;
        if (screening.note) existing.note = screening.note;
        continue;
      }

      listings.set(key, {
        id: key,
        filmKey: film.key,
        title: film.title,
        directors: film.directors ?? [],
        year: film.year ?? null,
        runtimeMin: film.runtimeMin ?? null,
        rating: film.mpaa ?? null,
        genres: film.genres ?? [],
        overview: film.overview ?? null,
        posterUrl: film.posterUrl ?? null,
        venueId: venue.id,
        venueName: venue.name,
        isAmc: venue.isAmc,
        date: screening.nightOf,
        showtimes: [showtime],
        tags: screening.tags ?? [],
        sourceUrl: `${SCENEF_BASE_URL}/theater/${venue.id}`,
        sourceTier: screening.source_tier ?? null,
        confidence: screening.confidence ?? null,
        verifiedAt: screening.verified_at ?? null,
        freshness: screening.freshness ?? null,
        note: screening.note ?? null,
      });
    }
  }

  const sortedListings = [...listings.values()]
    .map((listing) => ({
      ...listing,
      showtimes: listing.showtimes.sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    }))
    .sort((a, b) => {
      const firstTime = a.showtimes[0]?.startsAt ?? "";
      const secondTime = b.showtimes[0]?.startsAt ?? "";
      return firstTime.localeCompare(secondTime) || a.title.localeCompare(b.title);
    });

  const dataAsOf = feeds
    .map(({ feed }) => feed.data_as_of)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  return {
    attribution,
    dataAsOf,
    range: { start, end, days },
    venues: [...VENUES],
    listings: sortedListings,
    sources,
  };
}

export async function fetchSceneFListings(): Promise<ListingsPayload> {
  const settled = await Promise.allSettled(
    VENUES.map(async (venue) => {
      const apiUrl = `${SCENEF_BASE_URL}/api/listings?region=sf&venue=${venue.id}`;
      const response = await fetch(apiUrl, {
        headers: { Accept: "application/json" },
        next: { revalidate: 1800 },
      });

      if (!response.ok) {
        throw new Error(`SceneF ${venue.id} returned HTTP ${response.status}`);
      }

      return { venue, feed: (await response.json()) as SceneFFeed };
    }),
  );

  const feeds = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (feeds.length === 0) {
    throw new Error("Every SceneF venue request failed.");
  }

  const payload = normalizeFeeds(feeds);
  const failedSources = settled.flatMap((result, index) => {
    if (result.status === "fulfilled") return [];
    const venue = VENUES[index];
    return [{
      venueId: venue.id,
      venueName: venue.name,
      sourceUrl: `${SCENEF_BASE_URL}/theater/${venue.id}`,
      latestListingDate: null,
      reachesWindowEnd: false,
      error: result.reason instanceof Error ? result.reason.message : "SceneF request failed",
    }];
  });

  return {
    ...payload,
    sources: [
      ...payload.sources,
      ...failedSources,
    ].sort((a, b) => a.venueName.localeCompare(b.venueName)),
  };
}
