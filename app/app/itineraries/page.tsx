import Link from "next/link";
import { itineraries } from "./data";

export default function ItinerariesIndex() {
  return (
    <div className="bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-12 px-6 pb-24 pt-16 sm:px-10">
        <div className="space-y-4">
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-xs uppercase tracking-[0.25em] text-emerald-200">
            ecoTrips itineraries
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Immersive, measurable adventures</h1>
          <p className="max-w-3xl text-lg text-slate-300">
            Every departure is vetted for emissions impact, supplier equity, and on-trip support. Explore a sampling of our most requested routes below—each tailored to different traveler intents.
          </p>
          <Link href="/" className="text-sm font-semibold text-emerald-300 transition hover:text-emerald-100">
            ← Back to marketing site
          </Link>
        </div>
        <div className="grid gap-8 md:grid-cols-2">
          {itineraries.map((itinerary) => (
            <Link
              key={itinerary.slug}
              href={{ pathname: `/itineraries/${itinerary.slug}` }}
              className="group flex h-full flex-col justify-between gap-4 rounded-3xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-emerald-400/60"
            >
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">{itinerary.duration}</p>
                <h2 className="text-2xl font-semibold text-white">{itinerary.name}</h2>
                <p className="text-sm text-slate-300">{itinerary.summary}</p>
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs text-emerald-200">
                  <span className="rounded-full border border-emerald-500/40 px-3 py-1">{itinerary.impact}</span>
                  {itinerary.trustSignals.slice(0, 3).map((signal) => (
                    <span key={signal} className="rounded-full border border-emerald-500/20 px-3 py-1">
                      {signal}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                  {itinerary.suitability.map((item) => (
                    <span key={item} className="rounded-full border border-slate-700/60 px-3 py-1">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <span className="self-end rounded-full border border-emerald-500/40 px-3 py-1 text-sm text-emerald-200 transition group-hover:bg-emerald-500/20">
                View details →
              </span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
