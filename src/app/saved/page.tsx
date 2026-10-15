import type { Metadata } from "next";
import ShowtimesApp from "@/components/showtimes-app";

export const metadata: Metadata = {
  title: "Saved screenings — Blist",
  description: "Your saved San Francisco movie screenings.",
};

export default function SavedPage() {
  return <ShowtimesApp savedOnly />;
}
