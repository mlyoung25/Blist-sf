# Blist

A minimal, movie-first San Francisco showtimes guide. Listings are fetched from the
public [SceneF API](https://scenef.com/agents), normalized on the server, and shown
without synthetic fallback data.

One card represents a movie across every configured theater. Open a card to see each
theater's full currently published run, grouped by date. An ellipsis means the movie
reaches that theater's last published SceneF date, so later availability is unknown.

The optional AMC filter fetches SceneF's `amc-kabuki` and `amc-metreon` feeds and
removes a whole movie card when a normalized title match appears at either AMC. It
fails closed if either AMC source cannot be checked.

## Data refresh schedule

Vercel Cron calls `/api/refresh` at `00:00`, `11:00`, `12:00`, and `23:00` UTC.
The authenticated route refreshes only when that instant is **4:00 AM or 4:00 PM in
`America/Los_Angeles`**, one hour after SceneF's documented 3:00 AM and 3:00 PM
updates. The paired UTC candidates cover both PST and PDT; the IANA timezone guard
rejects the extra call and handles daylight-saving transitions without manually
changing the schedule. Configure `CRON_SECRET` in the deployment so Vercel sends
`Authorization: Bearer <CRON_SECRET>`.

The refresh invalidates the shared SceneF cache and prewarms all 11 theater sources
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
