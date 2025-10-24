import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getItinerary, itineraries } from "../data";

export function generateStaticParams() {
  return itineraries.map((itinerary) => ({ slug: itinerary.slug }));
}

type ItineraryPageProps = Readonly<{ params: Promise<{ slug: string }> }>;

export default async function ItineraryPage({ params }: ItineraryPageProps) {
  const { slug } = await params;
  const itinerary = getItinerary(slug);

  if (!itinerary) {
    notFound();
  }

  return (
    <div className="bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-16 px-6 pb-24 pt-14 sm:px-10">
        <Link href="/" className="text-sm text-emerald-300 transition hover:text-emerald-200">
          ← Back to itineraries
        </Link>
        <header className="space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-400/10 px-4 py-1 text-xs uppercase tracking-[0.25em] text-emerald-200">
            ecoTrips itinerary
            <span className="rounded-full bg-emerald-500/30 px-2 py-1 text-[0.6rem] font-semibold text-emerald-950">
              {itinerary.duration}
            </span>
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{itinerary.name}</h1>
          <p className="max-w-3xl text-lg text-slate-300">{itinerary.summary}</p>
          <div className="flex flex-wrap gap-4 text-sm text-emerald-200">
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1">
              {itinerary.impact}
            </span>
            {itinerary.trustSignals.map((signal) => (
              <span key={signal} className="rounded-full border border-emerald-500/30 px-3 py-1">
                {signal}
              </span>
            ))}
          </div>
        </header>
        <section className="overflow-hidden rounded-3xl border border-slate-800">
          <Image
            src={itinerary.heroImage}
            alt="Eco-friendly itinerary destination"
            width={1200}
            height={700}
            className="h-80 w-full object-cover"
          />
        </section>
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900/40 p-8">
            <h2 className="text-2xl font-semibold text-white">Highlights</h2>
            <ul className="space-y-6 text-base text-slate-200">
              {itinerary.highlights.map((highlight) => (
                <li key={highlight.title} className="space-y-1">
                  <p className="text-lg font-medium text-white">{highlight.title}</p>
                  <p className="text-slate-300">{highlight.description}</p>
                </li>
              ))}
            </ul>
          </div>
          <aside className="space-y-6 rounded-3xl border border-emerald-500/40 bg-emerald-500/10 p-8 text-emerald-100">
            <h2 className="text-2xl font-semibold text-white">Best for</h2>
            <ul className="space-y-3 text-base">
              {itinerary.suitability.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="inline-flex h-3 w-3 rounded-full bg-emerald-300" />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href={{ pathname: "/", query: { itinerary: itinerary.slug } }}
              className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              Request proposal
            </Link>
          </aside>
        </section>
        <section className="space-y-6 rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
          <h2 className="text-2xl font-semibold text-white">Day-by-day preview</h2>
          <ol className="grid gap-4 md:grid-cols-2">
            {itinerary.dayByDay.map((entry) => (
              <li key={entry.title} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <p className="text-sm font-semibold uppercase tracking-wider text-emerald-300">{entry.title}</p>
                <p className="mt-2 text-slate-200">{entry.details}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
