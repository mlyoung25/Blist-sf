# Blist

A minimal, movie-first San Francisco showtimes guide. Listings are fetched from the
public [SceneF API](https://scenef.com/agents), normalized on the server, and shown
without synthetic fallback data.

One card represents a movie across every configured theater. Open a card to see each
theater's full currently published run, grouped by date. An ellipsis means the movie
reaches that theater's last published SceneF date, so later availability is unknown.

Movies appearing in SceneF's `amc-kabuki` or `amc-metreon` feeds are hidden by
default using normalized title matching. **Show all hidden** fetches the unfiltered
roster and also restores user-hidden cards. It fails closed if either AMC source
cannot be checked. Pins and manual hides persist in local storage; pins only reorder
the main movie grid and do not create a separate saved page.

The UI supports simultaneous theater selections and one-day/multi-day filtering.
One-day cards use a thicker blue outer border; verified On Film cards use a complete
gold inner border inside a fixed gap. Cards in both states show two unclipped,
concentric blue-outside/gold-inside rectangles without visible status badges.
Every card reserves the same border and gap space, so state changes do not alter card
or poster dimensions. Screen-reader-only status text and the labeled filters preserve
the same meaning nonvisually. Month dividers use each movie's earliest run start, so a
run that crosses into a later month stays before that month's divider.

At normal desktop widths the content occupies 70% of the viewport with four cards per
row and 15% margins on each side. That layout remains through a 1800px effective
viewport (approximately 80% zoom from a 1440px baseline). Above 1800px the content
expands to 88% and an auto-fill grid adds smaller cards and columns. Mobile remains a
single full-width card below 460px.

The importer rejects explicit non-film category labels and descriptions (live music,
music, comedy, concert-like events) plus secret-movie listings. Film metadata and
context prevent legitimate titles such as *They Live* and *Music* from being removed,
while explicit event-series prefixes such as *National Theatre Live*, *MET Opera Live
in HD*, and *Exhibition on Screen* are excluded.

## Ratings, links, and ordering

Only verified IMDb scores from SceneF are currently displayed and used for sorting.
Letterboxd and TMDB rating labels are hidden until supported API access is configured.
SceneF TMDB and IMDb IDs still drive direct movie links where available, with encoded
search links as fallbacks.

SceneF's current listings, film pages, OpenAPI contract, and public film-details tool
do not expose language metadata. Cards therefore show **Language: Unknown** rather
than inferring language from title, country, cast, or external databases. The importer
will preserve a future SceneF `languages` field when present.

### TODO

- [ ] Apply for official Letterboxd API access at `api@letterboxd.com`, configure its
  OAuth client credentials, and add cached, provenance-aware aggregate ratings.
- [ ] Obtain an approved TMDB API key before adding TMDB ratings.

The unofficial `letterboxd-client` package is a typed wrapper around Letterboxd's
official endpoints; it still requires a Letterboxd-issued API key and secret and does
not replace the access application.

Pinned cards remain in a global section above the computed list. Unpinned cards group
chronologically by the month of their earliest theater-run start date; a run crossing
into another month remains in its start month. Within each month, the earliest relevant
showing date sorts first, followed by IMDb score for movies on that same day, title,
then stable movie ID. Selecting a date bubble filters to movies playing that day.

## On Film

On Film membership is matched only by SceneF's own film slug from the rendered,
server-authored [`/on-film`](https://scenef.com/on-film) page. The app does not infer
membership from age, genre, repertory tags, or theater. The page is cached alongside
the listings for 12 hours; fetch failures are isolated and reported in the source
details instead of marking unverified movies. Matching cards receive an accessible
yellow treatment and can be filtered with the gold **On Film** checkbox. The blue
**One day** checkbox matches the one-day card's outer border and replaces the
general run-length selector.

The root `<html>` uses React's narrow `suppressHydrationWarning` escape hatch because
browser extensions can inject attributes there before hydration. No app subtree uses
the suppression; production browser tests still fail on any app-generated hydration
or page error.

## Data refresh schedule

Vercel Cron calls `/api/refresh` at `00:00`, `11:00`, `12:00`, and `23:00` UTC.
The authenticated route refreshes only when that instant is **4:00 AM or 4:00 PM in
`America/Los_Angeles`**, one hour after SceneF's documented 3:00 AM and 3:00 PM
updates. The paired UTC candidates cover both PST and PDT; the IANA timezone guard
rejects the extra call and handles daylight-saving transitions without manually
changing the schedule. Configure `CRON_SECRET` in the deployment so Vercel sends
`Authorization: Bearer <CRON_SECRET>`.

The refresh invalidates the shared SceneF cache and prewarms all 10 theater sources,
the On Film page, and both AMC comparison sources. SceneF's per-screening freshness,
confidence, verification timestamp, and stable `/go/` ticket URL remain attached to
normalized runs.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js.

## Quality checks

```bash
npm run lint
npm run test:data
npm run build
# With the production server running on port 43127:
npm run test:ui
```

Built with Next.js, TypeScript, Tailwind CSS, and shadcn/ui.
