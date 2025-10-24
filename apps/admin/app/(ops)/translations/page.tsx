import { CardGlass } from "@ecotrips/ui";

import tmFixtures from "../../../../../ops/fixtures/translate_tm.json" assert { type: "json" };

import { TmBrowser } from "./_components/TmBrowser";

type FixtureRow = {
  id?: number;
  source_lang?: string;
  target_lang?: string;
  source_text?: string;
  target_text?: string;
  forward_hits?: number;
  reverse_hits?: number;
  updated_at?: string;
};

function loadFixtureRows(): FixtureRow[] {
  if (Array.isArray(tmFixtures)) {
    return tmFixtures as FixtureRow[];
  }
  return [];
}

export default function TranslationsPage() {
  const fixtures = loadFixtureRows().map((row) => ({
    id: row.id,
    source_lang: (row.source_lang ?? "").toString().toLowerCase(),
    target_lang: (row.target_lang ?? "").toString().toLowerCase(),
    source_text: (row.source_text ?? "").toString(),
    target_text: (row.target_text ?? "").toString(),
    forward_hits: Number.isFinite(Number(row.forward_hits))
      ? Number(row.forward_hits)
      : 0,
    reverse_hits: Number.isFinite(Number(row.reverse_hits))
      ? Number(row.reverse_hits)
      : 0,
    updated_at: row.updated_at ?? "fixture",
  }));

  return (
    <CardGlass
      title="Translation memory"
      subtitle="Search bilingual segments and rehearse admin edits before wiring up live tokens."
    >
      <div className="space-y-4 text-sm text-white/70">
        <p>
          The translate edge function checks the translation memory table before falling back to the fixture-backed model.
          Each hit increments forward counters and writes-through new segments so repeated lookups stay warm.
        </p>
        <p className="text-xs uppercase tracking-wide text-amber-200/70">
          Preview mode · entries below mirror <code>comms.tm</code> rows using offline fixtures
        </p>
      </div>
      <div className="mt-6">
        <TmBrowser initialRows={fixtures} />
      </div>
    </CardGlass>
  );
}
