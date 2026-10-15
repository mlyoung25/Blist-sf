"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  Heart,
  MapPin,
  Menu,
  Search,
  SlidersHorizontal,
  Sparkles,
  Ticket,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const days = [
  { label: "Tonight", date: "Oct 15", key: "Tonight" },
  { label: "Fri", date: "Oct 16", key: "Friday" },
  { label: "Sat", date: "Oct 17", key: "Saturday" },
  { label: "Sun", date: "Oct 18", key: "Sunday" },
  { label: "Mon", date: "Oct 19", key: "Monday" },
];

const films = [
  {
    id: 1,
    title: "The Secret Agent",
    director: "Kleber Mendonça Filho",
    year: "2025",
    runtime: "2h 38m",
    rating: "NR",
    venue: "Roxie Theater",
    neighborhood: "Mission",
    day: "Tonight",
    times: ["6:15 PM", "9:20 PM"],
    tags: ["New release", "Portuguese"],
    description: "A technology researcher on the run returns to Recife during Carnival, hoping to reunite with his son.",
    image: "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 2,
    title: "Black Orpheus",
    director: "Marcel Camus",
    year: "1959",
    runtime: "1h 47m",
    rating: "PG",
    venue: "BAMPFA",
    neighborhood: "Berkeley",
    day: "Tonight",
    times: ["7:00 PM"],
    tags: ["Restored", "35mm"],
    description: "The Greek myth of Orpheus and Eurydice unfolds amid the color and rhythm of Carnival in Rio.",
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 3,
    title: "Eephus",
    director: "Carson Lund",
    year: "2024",
    runtime: "1h 38m",
    rating: "NR",
    venue: "4 Star Theater",
    neighborhood: "Richmond",
    day: "Friday",
    times: ["5:40 PM", "8:10 PM"],
    tags: ["Staff pick", "Comedy"],
    description: "Two recreational baseball teams play one final game before their beloved field is demolished.",
    image: "https://images.unsplash.com/photo-1508344928928-7165b67de128?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 4,
    title: "Daughters of the Dust",
    director: "Julie Dash",
    year: "1991",
    runtime: "1h 52m",
    rating: "NR",
    venue: "Alamo Drafthouse",
    neighborhood: "Mission",
    day: "Friday",
    times: ["6:30 PM", "9:15 PM"],
    tags: ["Essential cinema", "4K"],
    description: "Three generations of Gullah women prepare to migrate from their Sea Island home in 1902.",
    image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 5,
    title: "A Real Pain",
    director: "Jesse Eisenberg",
    year: "2024",
    runtime: "1h 30m",
    rating: "R",
    venue: "Balboa Theater",
    neighborhood: "Outer Richmond",
    day: "Saturday",
    times: ["4:15 PM", "6:45 PM"],
    tags: ["Encore", "Comedy"],
    description: "Mismatched cousins reunite for a tour through Poland to honor their grandmother.",
    image: "https://images.unsplash.com/photo-1484318571209-661cf29a69c3?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 6,
    title: "Paris, Texas",
    director: "Wim Wenders",
    year: "1984",
    runtime: "2h 25m",
    rating: "R",
    venue: "The Castro Theatre",
    neighborhood: "Castro",
    day: "Sunday",
    times: ["3:00 PM", "7:00 PM"],
    tags: ["40th anniversary", "4K"],
    description: "A nearly mute drifter reconnects with his young son and sets out to find his missing wife.",
    image: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd4297?auto=format&fit=crop&w=900&q=85",
  },
];

const venues = ["All venues", "Roxie Theater", "BAMPFA", "4 Star Theater", "Alamo Drafthouse", "Balboa Theater", "The Castro Theatre"];

export default function ShowtimesApp({ savedOnly = false }: { savedOnly?: boolean }) {
  const [selectedDay, setSelectedDay] = useState("Tonight");
  const [venue, setVenue] = useState("All venues");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<number[]>([]);
  const [selectedFilm, setSelectedFilm] = useState<(typeof films)[number] | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("reel-local-saved");
    if (stored) {
      const savedIds = JSON.parse(stored) as number[];
      window.setTimeout(() => setSaved(savedIds), 0);
    }
  }, []);

  const toggleSaved = (id: number) => {
    const next = saved.includes(id) ? saved.filter((filmId) => filmId !== id) : [...saved, id];
    setSaved(next);
    window.localStorage.setItem("reel-local-saved", JSON.stringify(next));
  };

  const visibleFilms = useMemo(() => films.filter((film) => {
    const searchTarget = `${film.title} ${film.director} ${film.venue}`.toLowerCase();
    return (!savedOnly || saved.includes(film.id))
      && (savedOnly || film.day === selectedDay)
      && (venue === "All venues" || film.venue === venue)
      && searchTarget.includes(query.toLowerCase());
  }), [selectedDay, venue, query, saved, savedOnly]);

  return (
    <main className="min-h-screen bg-[#f4f0e8] text-[#1b1c19]">
      <header className="border-b border-black/10 bg-[#f4f0e8]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 md:px-10">
          <a href="#" className="flex items-center gap-3" aria-label="Reel Local home">
            <span className="grid size-9 place-items-center rounded-full bg-[#ff4e2f] text-white">
              <Ticket className="size-4.5 -rotate-12" strokeWidth={2.4} />
            </span>
            <span className="font-display text-[1.65rem] leading-none tracking-[-0.04em]">Reel Local</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
            <Link className={savedOnly ? "text-black/55 transition hover:text-black" : "border-b border-black pb-1"} href="/#showtimes">Showtimes</Link>
            <Link className="text-black/55 transition hover:text-black" href="/#venues">Venues</Link>
            <Link className={`flex items-center gap-2 ${savedOnly ? "border-b border-black pb-1" : "text-black/55 transition hover:text-black"}`} href="/saved">
              Saved <span className="rounded-full bg-black px-2 py-0.5 text-[10px] text-white">{saved.length}</span>
            </Link>
          </nav>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu"><Menu className="size-5" /></Button>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-black/10">
        <div className="pointer-events-none absolute -right-28 -top-32 size-[430px] rounded-full bg-[#ff4e2f]/13 blur-3xl" />
        <div className="mx-auto max-w-[1440px] px-5 pb-16 pt-14 md:px-10 md:pb-24 md:pt-24">
          <div className="mb-8 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#e03e25]">
            <Sparkles className="size-3.5" /> Bay Area independent cinema
          </div>
          <h1 className="font-display max-w-5xl text-[clamp(3.3rem,8vw,7.8rem)] leading-[0.84] tracking-[-0.055em]">
            Your next great film is playing nearby.
          </h1>
          <div className="mt-10 flex max-w-4xl flex-col gap-6 md:mt-12 md:flex-row md:items-end md:justify-between">
            <p className="max-w-lg text-base leading-7 text-black/62 md:text-lg">
              One hand-picked calendar for the Bay&apos;s independent theaters, repertory houses, and microcinemas.
            </p>
            <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.14em] text-black/45">Updated 8:00 AM</span>
          </div>
        </div>
      </section>

      <section id="showtimes" className="mx-auto max-w-[1440px] px-5 py-8 md:px-10 md:py-12">
        <div className="flex flex-col gap-6 border-b border-black/10 pb-8">
          {!savedOnly && <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {days.map((day) => (
              <button key={day.key} onClick={() => setSelectedDay(day.key)}
                className={`min-w-[104px] rounded-full border px-5 py-3 text-left transition ${selectedDay === day.key ? "border-black bg-black text-white" : "border-black/15 bg-white/35 hover:border-black/50"}`}>
                <span className="block text-sm font-semibold">{day.label}</span>
                <span className={`block text-[11px] ${selectedDay === day.key ? "text-white/55" : "text-black/45"}`}>{day.date}</span>
              </button>
            ))}
          </div>}
          <div className="flex flex-col justify-between gap-3 sm:flex-row">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-black/45" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)}
                placeholder="Search films, directors, venues"
                className="h-12 rounded-full border-black/15 bg-white/50 pl-11 shadow-none placeholder:text-black/38 focus-visible:border-black" />
            </div>
            <Sheet>
              <SheetTrigger render={<Button variant="outline" className="h-12 rounded-full border-black/15 bg-transparent px-5 shadow-none" />}>
                <SlidersHorizontal className="size-4" />{venue === "All venues" ? "Filter by venue" : venue}
              </SheetTrigger>
              <SheetContent className="bg-[#f4f0e8] px-6">
                <SheetHeader className="px-0 pt-8">
                  <SheetTitle className="font-display text-3xl">Choose a venue</SheetTitle>
                  <SheetDescription>Show films playing at one Bay Area cinema.</SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-2">
                  {venues.map((item) => (
                    <button key={item} onClick={() => setVenue(item)}
                      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left text-sm transition ${venue === item ? "border-black bg-black text-white" : "border-black/10 bg-white/40 hover:border-black/30"}`}>
                      {item}{venue === item && <Check className="size-4" />}
                    </button>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <div className="mb-7 mt-10 flex items-end justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#e03e25]">{savedOnly ? "Your watchlist" : `${selectedDay} in the Bay`}</p>
            <h2 className="font-display text-4xl tracking-tight md:text-5xl">{savedOnly ? "Saved screenings" : "Now showing"}</h2>
          </div>
          <span className="hidden text-sm text-black/45 sm:block">{visibleFilms.length} {visibleFilms.length === 1 ? "film" : "films"}</span>
        </div>

        {visibleFilms.length > 0 ? (
          <div className="grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {visibleFilms.map((film, index) => (
              <article key={film.id} className="group">
                <button className="relative block aspect-[4/3] w-full overflow-hidden rounded-[1.35rem] bg-neutral-900 text-left"
                  onClick={() => setSelectedFilm(film)} aria-label={`View details for ${film.title}`}>
                  <span className="absolute inset-0 bg-cover bg-center transition duration-700 group-hover:scale-105" style={{ backgroundImage: `url(${film.image})` }} />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />
                  <span className="absolute left-4 top-4 rounded-full bg-[#f4f0e8]/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] backdrop-blur">{film.tags[0]}</span>
                  <span className="font-display absolute bottom-4 left-4 text-6xl text-white/90">0{index + 1}</span>
                  <span className="absolute bottom-5 right-5 grid size-10 place-items-center rounded-full bg-white text-black opacity-0 transition group-hover:opacity-100"><ArrowUpRight className="size-5" /></span>
                </button>
                <div className="pt-5">
                  <div className="flex items-start justify-between gap-4">
                    <button onClick={() => setSelectedFilm(film)} className="text-left">
                      <h3 className="font-display text-[1.75rem] leading-none tracking-[-0.025em] transition group-hover:text-[#e03e25]">{film.title}</h3>
                      <p className="mt-2 text-sm text-black/52">{film.director} · {film.year} · {film.runtime}</p>
                    </button>
                    <Button variant="ghost" size="icon" onClick={() => toggleSaved(film.id)}
                      className="shrink-0 rounded-full hover:bg-black/5" aria-label={saved.includes(film.id) ? `Unsave ${film.title}` : `Save ${film.title}`}>
                      <Heart className={`size-5 ${saved.includes(film.id) ? "fill-[#ff4e2f] text-[#ff4e2f]" : ""}`} />
                    </Button>
                  </div>
                  <div className="mt-5 flex items-center gap-2 border-t border-black/10 pt-4">
                    <MapPin className="size-3.5 text-[#e03e25]" />
                    <span className="mr-auto text-xs font-semibold">{film.venue}</span>
                    {film.times.map((time) => (
                      <button key={time} onClick={() => setSelectedFilm(film)}
                        className="rounded-full border border-black/15 px-3 py-1.5 text-[11px] font-semibold transition hover:border-black hover:bg-black hover:text-white">{time}</button>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="grid min-h-72 place-items-center rounded-[1.5rem] border border-dashed border-black/20 bg-white/25 text-center">
            <div>
              <CalendarDays className="mx-auto mb-4 size-8 text-black/30" />
              <h3 className="font-display text-2xl">{savedOnly ? "Your list is ready for a first pick" : "Nothing on this reel"}</h3>
              <p className="mt-2 text-sm text-black/50">{savedOnly ? "Save a film and it will appear here." : "Try another date, venue, or search."}</p>
              {savedOnly ? (
                <Button variant="outline" render={<Link href="/#showtimes" />} className="mt-5 rounded-full border-black/20 bg-transparent">
                  Browse showtimes
                </Button>
              ) : (
                <Button variant="outline" onClick={() => { setQuery(""); setVenue("All venues"); }}
                  className="mt-5 rounded-full border-black/20 bg-transparent">Clear filters</Button>
              )}
            </div>
          </div>
        )}
      </section>

      <section id="venues" className="mt-8 bg-[#20221e] text-white">
        <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-16 md:grid-cols-[1fr_1.4fr] md:px-10 md:py-24">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ff6a50]">Across the Bay</p>
            <h2 className="font-display mt-4 text-5xl leading-[0.95] tracking-tight md:text-6xl">Seven screens.<br />One calendar.</h2>
          </div>
          <div className="grid grid-cols-2 gap-x-8 text-sm sm:grid-cols-3">
            {venues.slice(1).map((item, index) => (
              <div key={item} className="border-t border-white/15 py-4"><span className="mb-2 block text-[10px] text-white/35">0{index + 1}</span>{item}</div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-[#20221e] px-5 pb-8 text-white md:px-10">
        <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-4 border-t border-white/15 pt-6 text-xs text-white/40 sm:flex-row">
          <span>Reel Local · Made for people who stay through the credits.</span>
          <span>Schedules change — check with the theater before heading out.</span>
        </div>
      </footer>

      {selectedFilm && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 p-0 backdrop-blur-sm sm:place-items-center sm:p-6" onClick={() => setSelectedFilm(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="film-title"
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[1.75rem] bg-[#f4f0e8] p-5 shadow-2xl sm:rounded-[1.75rem] sm:p-7"
            onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <span className="rounded-full bg-[#ff4e2f]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#d93c24]">{selectedFilm.tags.join(" · ")}</span>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setSelectedFilm(null)} aria-label="Close film details"><X className="size-5" /></Button>
            </div>
            <div className="mb-7 aspect-[16/8] rounded-2xl bg-cover bg-center"
              style={{ backgroundImage: `linear-gradient(to top, rgba(0,0,0,.45), transparent), url(${selectedFilm.image})` }} />
            <h2 id="film-title" className="font-display text-4xl tracking-tight sm:text-5xl">{selectedFilm.title}</h2>
            <p className="mt-3 text-sm text-black/50">{selectedFilm.director} · {selectedFilm.year} · {selectedFilm.rating}</p>
            <p className="mt-5 text-[15px] leading-7 text-black/68">{selectedFilm.description}</p>
            <div className="mt-7 rounded-2xl border border-black/10 bg-white/45 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><MapPin className="size-4 text-[#e03e25]" /> {selectedFilm.venue}</div>
              <p className="ml-6 mt-1 text-xs text-black/45">{selectedFilm.neighborhood} · {selectedFilm.day}</p>
              <div className="mt-4 flex gap-2">
                {selectedFilm.times.map((time) => (
                  <Button key={time} className="flex-1 rounded-full bg-black text-white hover:bg-[#ff4e2f]"><Clock3 className="size-4" /> {time}</Button>
                ))}
              </div>
            </div>
            <button onClick={() => toggleSaved(selectedFilm.id)} className="mt-4 flex w-full items-center justify-center gap-2 py-2 text-sm font-semibold text-black/65">
              <Heart className={`size-4 ${saved.includes(selectedFilm.id) ? "fill-[#ff4e2f] text-[#ff4e2f]" : ""}`} />
              {saved.includes(selectedFilm.id) ? "Saved to your list" : "Save this screening"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
