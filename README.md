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
One-day cards and runs use a high-contrast cyan treatment. Month dividers use each
movie's earliest run start, so a run that crosses into a later month stays before that
month's divider.

The importer rejects explicit non-film category labels and descriptions (live music,
music, comedy, concert-like events) plus secret-movie listings. Film metadata and
context prevent legitimate titles such as *They Live* and *Music* from being removed,
while explicit event-series prefixes such as *National Theatre Live*, *MET Opera Live
in HD*, and *Exhibition on Screen* are excluded.

## Data refresh schedule

Vercel Cron calls `/api/refresh` at `00:00`, `11:00`, `12:00`, and `23:00` UTC.
The authenticated route refreshes only when that instant is **4:00 AM or 4:00 PM in
`America/Los_Angeles`**, one hour after SceneF's documented 3:00 AM and 3:00 PM
updates. The paired UTC candidates cover both PST and PDT; the IANA timezone guard
rejects the extra call and handles daylight-saving transitions without manually
changing the schedule. Configure `CRON_SECRET` in the deployment so Vercel sends
`Authorization: Bearer <CRON_SECRET>`.

The refresh invalidates the shared SceneF cache and prewarms all 10 theater sources
plus both AMC comparison sources. SceneF's per-screening freshness, confidence,
verification timestamp, and stable `/go/` ticket URL remain attached to normalized
runs.

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
