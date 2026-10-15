# Reel Local

A minimal San Francisco movie-showtimes guide. Listings are fetched from the public
[SceneF API](https://scenef.com/agents), normalized on the server, and shown without
synthetic fallback data.

The calendar always exposes a 14-day window beginning with SceneF's `tonight_is.night`.
Individual theaters may publish fewer than 14 days of schedules; the source status
section reports the latest date SceneF currently provides for each theater.

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
```

Built with Next.js, TypeScript, Tailwind CSS, and shadcn/ui.
