import Link from "next/link";
import { LeadCaptureForm } from "./components/LeadCaptureForm";
import { itineraries } from "./itineraries/data";

const highlights = [
  {
    title: "Curated by experts",
    description:
      "Our trip designers vet every partner, lodging, and activity so you can skip weeks of research.",
  },
  {
    title: "Measured impact",
    description:
      "Every itinerary ships with a transparent carbon statement and optional local offsets.",
  },
  {
    title: "24/7 on-trip ops",
    description:
      "Chat with a real operator in under 5 minutes for flight issues, reroutes, or concierge requests.",
  },
];

const sustainabilityStats = [
  { label: "Average emissions saved", value: "38% vs. traditional tours" },
  { label: "Verified suppliers", value: "62 local partners" },
  { label: "Traveler satisfaction", value: "4.9★ post-trip surveys" },
];

const featuredItineraries = itineraries.slice(0, 2);
const trustBadges = [
  "Certified B-Corp operators",
  "Global Sustainable Tourism Council member",
  "Stripe Climate climate-action partner",
];

const faqs = [
  {
    question: "How fast do you turn around a custom itinerary?",
    answer:
      "Funded trips receive three curated routes within two business days, including pricing bands and sustainability impact models tailored to your group size.",
  },
  {
    question: "Can you support corporate or educational compliance requirements?",
    answer:
      "Yes. We map activities to ESG frameworks, provide vendor insurance documentation, and deliver post-trip carbon accounting ready for stakeholder reviews.",
  },
  {
    question: "Do you work with travelers outside the Americas?",
    answer:
      "Our operator network spans LATAM, Europe, and APAC. We partner with on-the-ground hosts that meet our social impact and safety bar before any departure.",
  },
];

const testimonials = [
  {
    quote:
      "ecoTrips took the stress out of planning our Patagonia honeymoon. The operator team rerouted us around a strike overnight!",
    name: "Sam & Priya",
    role: "Traveled March 2025",
  },
  {
    quote:
      "Our school group's biodiversity workshop was seamless. The dashboard kept chaperones aligned and students energized.",
    name: "Marta L.",
    role: "Educator, Chicago",
  },
];

export default function Home() {
  return (
    <div className="bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-24 px-6 pb-32 pt-16 sm:px-10 lg:px-12">
        <section className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-8">
            <p className="inline-flex items-center rounded-full border border-slate-700 px-4 py-1 text-sm text-slate-300">
              Trusted itineraries, human support
            </p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Sustainable adventures tailored to the way you travel.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-slate-300">
              ecoTrips pairs ethical local partners with responsive operators so your next getaway leaves a lighter footprint and a lasting story.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                className="rounded-full bg-emerald-500 px-6 py-3 text-base font-semibold text-emerald-950 transition hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                href="#itineraries"
              >
                Explore itineraries
              </a>
              <a
                className="rounded-full border border-slate-700 px-6 py-3 text-base font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-200"
                href="#contact"
              >
                Talk to an operator
              </a>
            </div>
            <dl className="grid gap-4 sm:grid-cols-3">
              {sustainabilityStats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                  <dt className="text-xs uppercase tracking-wide text-slate-400">{stat.label}</dt>
                  <dd className="mt-2 text-lg font-semibold text-white">{stat.value}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-3 text-sm text-slate-300">
              {trustBadges.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2"
                >
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  {badge}
                </span>
              ))}
            </div>
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-emerald-600/40 bg-gradient-to-br from-emerald-400/20 via-emerald-500/5 to-slate-950 p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.35),_transparent_55%)]" aria-hidden />
            <div className="relative space-y-6">
              <h2 className="text-2xl font-semibold text-white">Upcoming departure snapshot</h2>
              <div className="rounded-2xl border border-emerald-500/30 bg-slate-950/60 p-5">
                <p className="text-sm uppercase tracking-wide text-emerald-200">Itinerary</p>
                <p className="mt-1 text-xl font-semibold text-white">Andean Stargazer · 8 days</p>
                <p className="mt-4 text-sm text-slate-300">
                  Solar-powered eco-lodge basecamp, night-sky navigation workshop, and restorative hiking across the Sacred Valley.
                </p>
                <ul className="mt-5 space-y-3 text-sm text-slate-200">
                  <li className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/50 text-sm font-medium text-emerald-200">
                      1
                    </span>
                    Arrival in Cusco & acclimatization walk
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/50 text-sm font-medium text-emerald-200">
                      2
                    </span>
                    Quechua culinary lab & regenerative farming visit
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/50 text-sm font-medium text-emerald-200">
                      3
                    </span>
                    Night hike with astronomer-led star mapping
                  </li>
                </ul>
              </div>
              <p className="text-sm text-emerald-200">
                Operators monitor weather, supplier confirmations, and traveler health in real-time from our Ops Console.
              </p>
            </div>
          </div>
        </section>

        <section id="itineraries" className="space-y-12">
          <div className="space-y-4">
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">Why travelers choose ecoTrips</h2>
            <p className="max-w-3xl text-lg text-slate-300">
              We bring together vetted suppliers, adaptive logistics, and transparent reporting so every itinerary balances thrill with responsibility.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {highlights.map((highlight) => (
              <article
                key={highlight.title}
                className="flex h-full flex-col justify-between rounded-3xl border border-slate-800 bg-slate-900/50 p-6 shadow-[0_12px_40px_-24px_rgba(16,185,129,0.6)]"
              >
                <div className="space-y-3">
                  <h3 className="text-xl font-semibold text-white">{highlight.title}</h3>
                  <p className="text-base text-slate-300">{highlight.description}</p>
                </div>
                <div className="mt-6 text-sm text-emerald-300">Included in every departure</div>
              </article>
            ))}
          </div>
          <div className="mt-12 space-y-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-2xl font-semibold text-white">Featured itineraries</h3>
                <p className="text-sm text-slate-400">Deep dive into sample departures with sustainability metrics and group suitability.</p>
              </div>
              <Link
                href="/itineraries"
                className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-300 hover:text-emerald-100"
              >
                Browse more departures
                <span aria-hidden>→</span>
              </Link>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {featuredItineraries.map((itinerary) => (
                <Link
                  key={itinerary.slug}
                  href={{ pathname: `/itineraries/${itinerary.slug}` }}
                  className="group relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-emerald-400/60"
                >
                  <p className="text-sm font-medium uppercase tracking-[0.25em] text-emerald-300">{itinerary.duration}</p>
                  <h4 className="mt-3 text-2xl font-semibold text-white">{itinerary.name}</h4>
                  <p className="mt-2 text-base text-slate-300">{itinerary.summary}</p>
                  <div className="mt-6 flex flex-wrap gap-3 text-xs text-emerald-200">
                    <span className="rounded-full border border-emerald-500/30 px-3 py-1">{itinerary.impact}</span>
                    {itinerary.trustSignals.slice(0, 2).map((signal) => (
                      <span key={signal} className="rounded-full border border-emerald-500/20 px-3 py-1">
                        {signal}
                      </span>
                    ))}
                  </div>
                  <span className="absolute right-6 top-6 inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/40 text-lg text-emerald-200 transition group-hover:bg-emerald-500/20">→</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div className="space-y-4">
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">Operational excellence meets traveler delight</h2>
            <p className="text-lg text-slate-300">
              Our operator console connects finance, supplier SLAs, and on-trip alerts so your experience stays seamless, even when plans shift.
            </p>
            <ul className="space-y-3 text-base text-slate-200">
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                Live manifests sync with airline, ferry, and lodge confirmations.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                Refunds and credits settle with ledger-ready documentation.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
                Supplier SLAs flag delays before they become traveler headaches.
              </li>
            </ul>
          </div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-[0_18px_60px_-32px_rgba(59,130,246,0.45)]">
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold text-white">Traveler portal preview</h3>
                <p className="text-sm text-slate-300">
                  Share interactive itineraries, offline tips, packing lists, and emergency contacts in one branded hub.
                </p>
              </div>
              <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-200">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-white">Daily logistics</p>
                    <p className="text-xs text-slate-400">Drop-in adjustments sync automatically</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-200">
                    Real-time
                  </span>
                </div>
                <div className="grid gap-2">
                  <p>• Supplier confirmations verified 2h before pickup</p>
                  <p>• WhatsApp concierge with translation support</p>
                  <p>• Offline PDF pack delivered 24h before departure</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Want a tailored preview for your group or incentive program? Our operators can assemble a sandbox within 48 hours.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-10">
          <div>
            <h2 className="text-3xl font-semibold text-white sm:text-4xl">Loved by travelers and partners</h2>
            <p className="mt-3 max-w-3xl text-lg text-slate-300">
              We measure satisfaction across travelers, local hosts, and corporate buyers to ensure each adventure benefits the full ecosystem.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {testimonials.map((testimonial) => (
              <figure
                key={testimonial.name}
                className="h-full rounded-3xl border border-slate-800 bg-slate-900/60 p-6"
              >
                <blockquote className="text-lg text-slate-200">“{testimonial.quote}”</blockquote>
                <figcaption className="mt-4 text-sm text-slate-400">
                  {testimonial.name} · {testimonial.role}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="space-y-8 rounded-3xl border border-slate-800 bg-slate-900/60 p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-3xl font-semibold text-white sm:text-4xl">Frequently asked questions</h2>
              <p className="mt-3 max-w-2xl text-lg text-slate-300">We bring operational rigor to bespoke trips. If you need procurement paperwork, carbon modeling, or group safety plans, we have you covered.</p>
            </div>
            <a
              className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-200 transition hover:text-emerald-100"
              href="mailto:hello@ecotrips.example"
            >
              Ask something else
              <span aria-hidden>→</span>
            </a>
          </div>
          <dl className="grid gap-6 md:grid-cols-2">
            {faqs.map((faq) => (
              <div key={faq.question} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
                <dt className="text-lg font-semibold text-white">{faq.question}</dt>
                <dd className="mt-3 text-sm text-slate-300">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="contact" className="rounded-3xl border border-emerald-600/40 bg-gradient-to-r from-emerald-500/20 via-emerald-400/10 to-slate-950 p-10 text-slate-100">
          <div className="grid gap-10 lg:grid-cols-[0.65fr_0.35fr] lg:items-start">
            <div className="space-y-6">
              <h2 className="text-3xl font-semibold text-white sm:text-4xl">Ready to co-create your next itinerary?</h2>
              <p className="max-w-3xl text-lg text-emerald-100/90">
                Share your travel goals and our operator team will assemble route options, supplier recommendations, and an impact snapshot within two business days.
              </p>
              <LeadCaptureForm />
              <div className="flex flex-wrap gap-4">
                <a
                  className="rounded-full bg-white px-6 py-3 text-base font-semibold text-emerald-700 transition hover:bg-emerald-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  href="mailto:hello@ecotrips.example"
                >
                  hello@ecotrips.example
                </a>
                <span className="flex items-center gap-2 rounded-full border border-emerald-400/60 px-5 py-3 text-sm text-emerald-100">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  Average reply time · 2h
                </span>
              </div>
            </div>
            <aside className="space-y-4 rounded-2xl border border-emerald-500/30 bg-slate-950/50 p-6 text-sm text-emerald-100">
              <h3 className="text-lg font-semibold text-white">What happens next</h3>
              <ol className="space-y-3 text-emerald-100/90">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-emerald-400/60 text-xs font-semibold">1</span>
                  Operators qualify your goals and assign a lead specialist in under two hours.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-emerald-400/60 text-xs font-semibold">2</span>
                  Receive three itinerary directions with emissions modeling, pricing bands, and supplier bios.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-emerald-400/60 text-xs font-semibold">3</span>
                  Approve, iterate, or request compliance documents—everything stays tracked in our ops console.
                </li>
              </ol>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-100">
                <p className="text-sm font-medium uppercase tracking-[0.2em]">Certifications</p>
                <ul className="mt-2 space-y-2 text-xs">
                  <li>• B-Corp verified operator partners</li>
                  <li>• GSTC-aligned itinerary review</li>
                  <li>• GDPR & SOC2-ready data handling</li>
                </ul>
              </div>
            </aside>
          </div>
        </section>
      </main>
      <footer className="border-t border-slate-900/70 bg-slate-950/95 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} ecoTrips. Crafted with our global partners.</p>
          <div className="flex flex-wrap gap-4">
            <a className="hover:text-slate-200" href="#itineraries">
              Itineraries
            </a>
            <a className="hover:text-slate-200" href="#contact">
              Contact
            </a>
            <a className="hover:text-slate-200" href="/ops">
              Operator console
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
