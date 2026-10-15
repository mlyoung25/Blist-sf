export const SCENEF_BASE_URL = "https://scenef.com";
export const SCENEF_CACHE_TAG = "scenef-showtimes";
export const SCENEF_ON_FILM_URL = `${SCENEF_BASE_URL}/on-film`;

export type VenueConfig = {
  id: string;
  name: string;
  isAmc: boolean;
  websiteUrl?: string;
};

export const VENUES: readonly VenueConfig[] = [
  { id: "4star", name: "4 Star Theatre", isAmc: false, websiteUrl: "https://www.4-star-movies.com" },
  { id: "alamo-new-mission", name: "Alamo Drafthouse", isAmc: false, websiteUrl: "https://drafthouse.com/sf#now-playing" },
  { id: "apple-van-ness", name: "Apple Cinemas Van Ness IMAX", isAmc: false, websiteUrl: "https://www.applecinemas.com/home/68543b29ef719f9969b8ad87" },
  { id: "balboa", name: "Balboa Theatre", isAmc: false, websiteUrl: "https://www.balboamovies.com" },
  { id: "opera-plaza", name: "Landmark Opera Plaza Cinema", isAmc: false, websiteUrl: "https://www.landmarktheatres.com" },
  { id: "marina", name: "Marina Theatre", isAmc: false, websiteUrl: "https://www.lntsf.com/marina-theatre" },
  { id: "presidio", name: "Presidio Theatre", isAmc: false, websiteUrl: "https://www.lntsf.com/presidio-theatre" },
  { id: "regal-stonestown", name: "Regal Stonestown Galleria 12", isAmc: false, websiteUrl: "https://www.regmovies.com/theatres/regal-stonestown-galleria-1464" },
  { id: "roxie", name: "Roxie Theatre", isAmc: false, websiteUrl: "https://roxie.com/calendar/" },
  { id: "vogue", name: "Vogue Theatre", isAmc: false, websiteUrl: "https://www.voguemovies.com" },
] as const;

export const AMC_VENUES: readonly VenueConfig[] = [
  { id: "amc-kabuki", name: "AMC Kabuki 8", isAmc: true },
  { id: "amc-metreon", name: "AMC Metreon 16", isAmc: true },
] as const;

export type SceneFFilm = {
  key: string;
  slug?: string;
  tmdbId?: number;
  imdbId?: string;
  title: string;
  year?: number;
  runtimeMin?: number;
  mpaa?: string;
  genres?: string[];
  languages?: string[];
  overview?: string;
  directors?: string[];
  posterUrl?: string;
  ratings?: {
    imdb?: number;
    tmdb?: number;
    rottenTomatoes?: number;
    metacritic?: number;
  };
};

type Freshness = {
  status?: string;
  age_hours?: number;
  retained?: boolean;
  source_status?: string;
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
  freshness?: Freshness;
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

export type RunDate = {
  date: string;
  showtimes: Showtime[];
};

export type TheaterRun = {
  venueId: string;
  venueName: string;
  sourceUrl: string;
  websiteUrl: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  endsAtPublishedHorizon: boolean;
  dates: RunDate[];
  sourceTier: string | null;
  confidence: string | null;
  verifiedAt: string | null;
  freshness: Freshness | null;
  note: string | null;
};

export type Movie = {
  id: string;
  sceneFSlug: string | null;
  tmdbId: number | null;
  imdbId: string | null;
  title: string;
  normalizedTitle: string;
  directors: string[];
  year: number | null;
  runtimeMin: number | null;
  rating: string | null;
  genres: string[];
  languages: string[];
  overview: string | null;
  posterUrl: string | null;
  ratings: {
    imdb: number | null;
  };
  onFilm: {
    matched: boolean;
    sourceUrl: string | null;
  };
  runs: TheaterRun[];
};

export type SourceStatus = {
  venueId: string;
  venueName: string;
  sourceUrl: string;
  latestListingDate: string | null;
  error?: string;
};

export type MoviesPayload = {
  attribution: "Showtimes via SceneF.com";
  dataAsOf: string | null;
  range: { start: string; end: string; days: number };
  venues: VenueConfig[];
  movies: Movie[];
  sources: SourceStatus[];
  amcFilter: {
    enabled: boolean;
    excludedMovieCount: number;
    excludedTitles: string[];
    sourceUrls: string[];
  };
  nonFilmFilter: {
    excludedMovieCount: number;
    excludedTitles: string[];
  };
  onFilmSource: {
    sourceUrl: string;
    fetchedAt: string | null;
    matchedMovieCount: number;
    error?: string;
  };
};

type FeedWithVenue = { venue: VenueConfig; feed: SceneFFeed };

function calendarDays(start: string, end: string) {
  const first = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  return Math.round((last.getTime() - first.getTime()) / 86_400_000) + 1;
}

function timeLabel(startsAt: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  }).format(new Date(startsAt));
}

export function normalizeMovieTitle(title: string) {
  return title
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en-US")
    .replace(/&/g, " and ")
    .replace(/['’‘`]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function movieSlug(title: string) {
  return normalizeMovieTitle(title).replace(/\s+/g, "-") || "movie";
}

export function letterboxdMovieUrl(movie: Pick<Movie, "title" | "year" | "tmdbId">) {
  if (movie.tmdbId !== null) return `https://letterboxd.com/tmdb/${movie.tmdbId}/`;
  const query = `${movie.title}${movie.year ? ` ${movie.year}` : ""}`;
  return `https://letterboxd.com/search/films/${encodeURIComponent(query)}/`;
}

export function tmdbMovieUrl(movie: Pick<Movie, "title" | "tmdbId">) {
  if (movie.tmdbId !== null) {
    return `https://www.themoviedb.org/movie/${movie.tmdbId}-${movieSlug(movie.title)}/`;
  }
  return `https://www.themoviedb.org/search/movie?query=${encodeURIComponent(movie.title)}`;
}

export function imdbMovieUrl(movie: Pick<Movie, "title" | "imdbId">) {
  if (movie.imdbId) return `https://www.imdb.com/title/${movie.imdbId}/`;
  return `https://www.imdb.com/find/?q=${encodeURIComponent(movie.title)}&s=tt`;
}

export function letterboxdDirectorUrl(director: string) {
  return `https://letterboxd.com/search/${encodeURIComponent(director)}/`;
}

export function parseOnFilmSlugs(html: string) {
  const renderedHtml = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ?? html;
  return new Set(
    [...renderedHtml.matchAll(/href=["']\/film\/([a-z0-9][a-z0-9-]*)["']/gi)]
      .map((match) => match[1].toLowerCase()),
  );
}

export function applyOnFilmMembership(
  payload: MoviesPayload,
  slugs: ReadonlySet<string>,
  fetchedAt: string,
): MoviesPayload {
  const movies = payload.movies.map((movie) => {
    const matched = movie.sceneFSlug !== null && slugs.has(movie.sceneFSlug.toLowerCase());
    return {
      ...movie,
      onFilm: {
        matched,
        sourceUrl: matched ? SCENEF_ON_FILM_URL : null,
      },
    };
  });
  return {
    ...payload,
    movies,
    onFilmSource: {
      sourceUrl: SCENEF_ON_FILM_URL,
      fetchedAt,
      matchedMovieCount: movies.filter((movie) => movie.onFilm.matched).length,
    },
  };
}

function titleMatchKeys(title: string) {
  const keys = new Set<string>();
  const normalized = normalizeMovieTitle(title);
  if (!normalized) return keys;
  keys.add(normalized);
  if (normalized.startsWith("the ")) keys.add(normalized.slice(4));

  const formatSuffix = /\s+(?:imax(?:\s+3d)?|dolby\s+cinema|3d|4dx|screenx|open\s+captions?|closed\s+captions?|fan\s+event|early\s+access\s+screenings?)$/;
  let withoutFormat = normalized;
  while (formatSuffix.test(withoutFormat)) {
    withoutFormat = withoutFormat.replace(formatSuffix, "").trim();
    if (withoutFormat) keys.add(withoutFormat);
  }

  return keys;
}

export function titlesMatch(first: string, second: string) {
  const firstKeys = titleMatchKeys(first);
  const secondKeys = titleMatchKeys(second);
  return [...firstKeys].some((key) => secondKeys.has(key));
}

export function isLikelyFilm(film: SceneFFilm, tags: string[] = []) {
  const title = normalizeMovieTitle(film.title);
  const overview = normalizeMovieTitle(film.overview ?? "");
  const tagText = normalizeMovieTitle(tags.join(" "));
  const hasFilmMetadata = Boolean(
    film.year
    || film.runtimeMin
    || film.posterUrl
    || (film.directors && film.directors.length > 0),
  );

  if (/\bsecret\s+(?:movie|screening)\b/i.test(film.title)) {
    return false;
  }

  const eventSeriesPrefix = /^(?:national theatre live|nt live|met(?:ropolitan)? opera(?: live(?: in hd)?)?|royal opera house|the royal ballet|bolshoi ballet|exhibition on screen|great art on screen)\b/;
  if (eventSeriesPrefix.test(title)) return false;

  const categoryLabelRaw = /^(?:live music|live|music|comedy|stand[- ]?up|concert|performance|talk|lecture|panel)\s*(?::|[|—-]|\s+at\b)/i;
  const categoryLabel = /^(?:live music|live|music|comedy|stand up|standup|concert|performance|talk|lecture|panel)\s+(?:at|with)\b/;
  const explicitLiveEvent = /\blive music\b|\bwith live (?:music|score)\b|\blive original score\b/;
  if (categoryLabelRaw.test(film.title) || categoryLabel.test(title) || explicitLiveEvent.test(title)) return false;

  const genericEventTitle = /^(?:live|music|comedy|stand up|standup|concert|performance|talk|lecture|panel)$/;
  const eventDescription = /\b(?:live music|performing live|live performance|stand up comedy|standup comedy|in concert|on stage)\b/;
  const eventTag = /\b(?:live music|live event|comedy show|concert|stage event)\b/;
  if (!hasFilmMetadata && (
    genericEventTitle.test(title)
    || eventDescription.test(overview)
    || eventTag.test(tagText)
  )) {
    return false;
  }

  return true;
}

function movieIdentity(film: SceneFFilm) {
  return `${normalizeMovieTitle(film.title)}:${film.year ?? "unknown"}`;
}

function sourceStatus(feeds: FeedWithVenue[]) {
  return feeds.map(({ venue, feed }) => ({
    venueId: venue.id,
    venueName: venue.name,
    sourceUrl: `${SCENEF_BASE_URL}/theater/${venue.id}`,
    latestListingDate: feed.screenings.map((screening) => screening.nightOf).sort().at(-1) ?? null,
  }));
}

export function normalizeFeeds(feeds: FeedWithVenue[]): MoviesPayload {
  const start = feeds.map(({ feed }) => feed.tonight_is.night).sort().at(-1);
  if (!start) throw new Error("SceneF returned no calendar start date.");

  if (feeds.some(({ feed }) => feed.attribution !== "Showtimes via SceneF.com")) {
    throw new Error("SceneF returned an unexpected or missing attribution.");
  }

  const statuses = sourceStatus(feeds);
  const horizonByVenue = new Map(statuses.map((status) => [status.venueId, status.latestListingDate]));
  const excludedNonFilmTitles = new Set<string>();
  const movieMap = new Map<string, {
    movie: Omit<Movie, "runs">;
    runs: Map<string, {
      run: Omit<TheaterRun, "dates" | "startDate" | "endDate" | "durationDays" | "endsAtPublishedHorizon">;
      dates: Map<string, Showtime[]>;
    }>;
  }>();

  for (const { venue, feed } of feeds) {
    const films = new Map(feed.films.map((film) => [film.key, film]));

    for (const screening of feed.screenings) {
      if (screening.nightOf < start) continue;
      const film = films.get(screening.filmKey);
      if (!film) continue;
      if (!isLikelyFilm(film, screening.tags)) {
        excludedNonFilmTitles.add(film.title);
        continue;
      }

      const identity = movieIdentity(film);
      let movieEntry = movieMap.get(identity);
      if (!movieEntry) {
        movieEntry = {
          movie: {
            id: identity,
            sceneFSlug: film.slug ?? null,
            tmdbId: film.tmdbId ?? null,
            imdbId: film.imdbId ?? null,
            title: film.title,
            normalizedTitle: normalizeMovieTitle(film.title),
            directors: film.directors ?? [],
            year: film.year ?? null,
            runtimeMin: film.runtimeMin ?? null,
            rating: film.mpaa ?? null,
            genres: film.genres ?? [],
            languages: film.languages ?? [],
            overview: film.overview ?? null,
            posterUrl: film.posterUrl ?? null,
            ratings: {
              imdb: film.ratings?.imdb ?? null,
            },
            onFilm: {
              matched: false,
              sourceUrl: null,
            },
          },
          runs: new Map(),
        };
        movieMap.set(identity, movieEntry);
      } else {
        if (!movieEntry.movie.posterUrl && film.posterUrl) movieEntry.movie.posterUrl = film.posterUrl;
        if (!movieEntry.movie.overview && film.overview) movieEntry.movie.overview = film.overview;
        if (movieEntry.movie.directors.length === 0 && film.directors) movieEntry.movie.directors = film.directors;
        if (movieEntry.movie.languages.length === 0 && film.languages) movieEntry.movie.languages = film.languages;
        if (movieEntry.movie.sceneFSlug === null && film.slug) movieEntry.movie.sceneFSlug = film.slug;
        if (movieEntry.movie.tmdbId === null && film.tmdbId) movieEntry.movie.tmdbId = film.tmdbId;
        if (movieEntry.movie.imdbId === null && film.imdbId) movieEntry.movie.imdbId = film.imdbId;
        if (movieEntry.movie.ratings.imdb === null && film.ratings?.imdb !== undefined) {
          movieEntry.movie.ratings.imdb = film.ratings.imdb;
        }
      }

      let runEntry = movieEntry.runs.get(venue.id);
      if (!runEntry) {
        runEntry = {
          run: {
            venueId: venue.id,
            venueName: venue.name,
            sourceUrl: `${SCENEF_BASE_URL}/theater/${venue.id}`,
            websiteUrl: venue.websiteUrl ?? `${SCENEF_BASE_URL}/theater/${venue.id}`,
            sourceTier: screening.source_tier ?? null,
            confidence: screening.confidence ?? null,
            verifiedAt: screening.verified_at ?? null,
            freshness: screening.freshness ?? null,
            note: screening.note ?? null,
          },
          dates: new Map(),
        };
        movieEntry.runs.set(venue.id, runEntry);
      }

      const showtimes = runEntry.dates.get(screening.nightOf) ?? [];
      if (!showtimes.some((showtime) => showtime.id === screening.id)) {
        showtimes.push({
          id: screening.id,
          startsAt: screening.startsAt,
          label: timeLabel(screening.startsAt),
          ticketUrl: screening.ticketUrl,
        });
      }
      runEntry.dates.set(screening.nightOf, showtimes);

      if (screening.freshness?.status !== "current") runEntry.run.freshness = screening.freshness ?? null;
      if (screening.confidence === "disputed") runEntry.run.confidence = screening.confidence;
      if (screening.note) runEntry.run.note = screening.note;
      if (screening.verified_at && (!runEntry.run.verifiedAt || screening.verified_at > runEntry.run.verifiedAt)) {
        runEntry.run.verifiedAt = screening.verified_at;
      }
    }
  }

  const movies = [...movieMap.values()].map(({ movie, runs }) => ({
    ...movie,
    runs: [...runs.values()].map(({ run, dates }) => {
      const sortedDates = [...dates.entries()]
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([date, showtimes]) => ({
          date,
          showtimes: showtimes.sort((first, second) => first.startsAt.localeCompare(second.startsAt)),
        }));
      const startDate = sortedDates[0].date;
      const endDate = sortedDates.at(-1)?.date ?? startDate;
      return {
        ...run,
        startDate,
        endDate,
        durationDays: calendarDays(startDate, endDate),
        endsAtPublishedHorizon: horizonByVenue.get(run.venueId) === endDate,
        dates: sortedDates,
      };
    }).sort((first, second) => first.startDate.localeCompare(second.startDate) || first.venueName.localeCompare(second.venueName)),
  })).sort((first, second) => {
    const firstDate = first.runs[0]?.startDate ?? "";
    const secondDate = second.runs[0]?.startDate ?? "";
    return firstDate.localeCompare(secondDate) || first.title.localeCompare(second.title);
  });

  const end = statuses.map((status) => status.latestListingDate).filter((date): date is string => Boolean(date)).sort().at(-1) ?? start;
  const dataAsOf = feeds.map(({ feed }) => feed.data_as_of).filter(Boolean).sort().at(-1) ?? null;

  return {
    attribution: "Showtimes via SceneF.com",
    dataAsOf,
    range: { start, end, days: calendarDays(start, end) },
    venues: [...VENUES],
    movies,
    sources: statuses,
    amcFilter: {
      enabled: false,
      excludedMovieCount: 0,
      excludedTitles: [],
      sourceUrls: [],
    },
    nonFilmFilter: {
      excludedMovieCount: excludedNonFilmTitles.size,
      excludedTitles: [...excludedNonFilmTitles].sort(),
    },
    onFilmSource: {
      sourceUrl: SCENEF_ON_FILM_URL,
      fetchedAt: null,
      matchedMovieCount: 0,
    },
  };
}

export function excludeMoviesPlayingAtAmc(payload: MoviesPayload, amcFeeds: FeedWithVenue[]): MoviesPayload {
  const amcTitles = new Set<string>();
  for (const { feed } of amcFeeds) {
    const films = new Map(feed.films.map((film) => [film.key, film]));
    for (const screening of feed.screenings) {
      if (screening.nightOf < payload.range.start) continue;
      const title = films.get(screening.filmKey)?.title;
      if (!title) continue;
      for (const key of titleMatchKeys(title)) amcTitles.add(key);
    }
  }

  const excluded: string[] = [];
  const movies = payload.movies.filter((movie) => {
    const matches = [...titleMatchKeys(movie.title)].some((key) => amcTitles.has(key));
    if (matches) excluded.push(movie.title);
    return !matches;
  });

  return {
    ...payload,
    movies,
    onFilmSource: {
      ...payload.onFilmSource,
      matchedMovieCount: movies.filter((movie) => movie.onFilm.matched).length,
    },
    sources: [...payload.sources, ...sourceStatus(amcFeeds)].sort((first, second) => first.venueName.localeCompare(second.venueName)),
    amcFilter: {
      enabled: true,
      excludedMovieCount: excluded.length,
      excludedTitles: [...new Set(excluded)].sort(),
      sourceUrls: AMC_VENUES.map((venue) => `${SCENEF_BASE_URL}/api/listings?region=sf&venue=${venue.id}`),
    },
  };
}

async function fetchVenue(venue: VenueConfig): Promise<FeedWithVenue> {
  const apiUrl = `${SCENEF_BASE_URL}/api/listings?region=sf&venue=${venue.id}`;
  const response = await fetch(apiUrl, {
    headers: { Accept: "application/json" },
    next: {
      revalidate: 43_200,
      tags: [SCENEF_CACHE_TAG, `scenef-venue-${venue.id}`],
    },
  });

  if (!response.ok) throw new Error(`SceneF ${venue.id} returned HTTP ${response.status}`);
  return { venue, feed: (await response.json()) as SceneFFeed };
}

async function fetchOnFilmMembership() {
  const response = await fetch(SCENEF_ON_FILM_URL, {
    headers: { Accept: "text/html" },
    next: {
      revalidate: 43_200,
      tags: [SCENEF_CACHE_TAG, "scenef-on-film"],
    },
  });
  if (!response.ok) throw new Error(`SceneF On Film returned HTTP ${response.status}`);
  const slugs = parseOnFilmSlugs(await response.text());
  if (slugs.size === 0) throw new Error("SceneF On Film returned no verifiable film links.");
  return {
    slugs,
    fetchedAt: response.headers.get("date") ?? new Date().toISOString(),
  };
}

export async function fetchSceneFMovies({ excludeAmc = false } = {}): Promise<MoviesPayload> {
  const [settled, onFilmResult] = await Promise.all([
    Promise.allSettled(VENUES.map(fetchVenue)),
    fetchOnFilmMembership().then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error }),
    ),
  ]);
  const feeds = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (feeds.length === 0) throw new Error("Every SceneF theater request failed.");

  const normalizedPayload = normalizeFeeds(feeds);
  const payload = onFilmResult.ok
    ? applyOnFilmMembership(normalizedPayload, onFilmResult.value.slugs, onFilmResult.value.fetchedAt)
    : {
        ...normalizedPayload,
        onFilmSource: {
          ...normalizedPayload.onFilmSource,
          error: onFilmResult.error instanceof Error ? onFilmResult.error.message : "SceneF On Film request failed",
        },
      };
  const failedSources = settled.flatMap((result, index) => {
    if (result.status === "fulfilled") return [];
    const venue = VENUES[index];
    return [{
      venueId: venue.id,
      venueName: venue.name,
      sourceUrl: `${SCENEF_BASE_URL}/theater/${venue.id}`,
      latestListingDate: null,
      error: result.reason instanceof Error ? result.reason.message : "SceneF request failed",
    }];
  });

  const completePayload = {
    ...payload,
    sources: [...payload.sources, ...failedSources].sort((first, second) => first.venueName.localeCompare(second.venueName)),
  };

  if (!excludeAmc) return completePayload;

  const amcSettled = await Promise.allSettled(AMC_VENUES.map(fetchVenue));
  const amcFailure = amcSettled.find((result) => result.status === "rejected");
  if (amcFailure?.status === "rejected") {
    const reason = amcFailure.reason instanceof Error ? amcFailure.reason.message : "unknown error";
    throw new Error(`AMC title filtering is unavailable because a SceneF AMC source failed: ${reason}`);
  }

  const amcFeeds = amcSettled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  return excludeMoviesPlayingAtAmc(completePayload, amcFeeds);
}
