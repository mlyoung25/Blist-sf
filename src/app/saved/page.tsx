import type { Metadata } from "next";
import ShowtimesApp from "@/components/showtimes-app";

export const metadata: Metadata = {
  title: "Saved screenings — Reel Local",
  description: "Your saved Bay Area independent film screenings.",
};

export default function SavedPage() {
  return <ShowtimesApp savedOnly />;
}
