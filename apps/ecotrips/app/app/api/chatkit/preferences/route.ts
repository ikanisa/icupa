import { NextResponse } from "next/server";

const DOMAIN_KEY = process.env.CHATKIT_DOMAIN_KEY;

type PlannerRequest = {
  destination?: string;
  travelMonth?: string;
  nights?: number;
  travelers?: number;
  carbonFocus?: string;
  mobilitySupport?: string;
  interests?: string[];
  notes?: string;
};

type PlannerResponse = {
  ok: true;
  summary: string;
  composerPrompt: string;
  highlights: string[];
  sustainabilityTips: string[];
};

type ErrorResponse = {
  ok: false;
  error: string;
  issues?: string[];
};

function formatMonthLabel(value: string | undefined) {
  if (!value) return "the upcoming season";
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function normalizeText(value: string | undefined, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeNumber(value: number | string | undefined, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

function normalizeInterests(source: unknown, fallback: string[]): string[] {
  if (Array.isArray(source)) {
    return source
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  }

  if (typeof source === "string") {
    return source
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return fallback;
}

function buildHighlights(preferences: Required<PlannerRequest>) {
  const highlights: string[] = [];
  const monthLabel = formatMonthLabel(preferences.travelMonth);
  highlights.push(`Focus destination: ${preferences.destination} (${monthLabel})`);
  highlights.push(`Group size: ${preferences.travelers} travelers for ${preferences.nights} nights`);
  if (preferences.interests.length > 0) {
    highlights.push(`Key interests: ${preferences.interests.map((item) => item.replace(/-/g, " ")).join(", ")}`);
  }
  if (preferences.notes) {
    highlights.push(`Special notes: ${preferences.notes}`);
  }
  return highlights;
}

function buildSustainabilityTips(preferences: Required<PlannerRequest>) {
  const tips = new Set<string>();
  switch (preferences.carbonFocus) {
    case "off-grid":
      tips.add("Prioritize solar-powered eco-lodges and micro-grid retreats");
      tips.add("Include regenerative agriculture workshops with local partners");
      break;
    case "balanced":
      tips.add("Bundle nonstop flights with certified carbon removal purchases");
      tips.add("Favor accommodations with third-party sustainability certifications");
      break;
    default:
      tips.add("Prefer rail and electric mobility within the itinerary");
      tips.add("Book suppliers participating in verified community benefit programs");
      break;
  }

  if (preferences.mobilitySupport === "Wheelchair") {
    tips.add("Confirm step-free transfers and ADA-compliant lodging in every stop");
  } else if (preferences.mobilitySupport === "Limited mobility") {
    tips.add("Surface e-bike or low-impact transport alternatives for varied abilities");
  }

  if (preferences.interests.includes("marine")) {
    tips.add("Coordinate reef-safe snorkeling and citizen science marine patrols");
  }
  if (preferences.interests.includes("rainforest")) {
    tips.add("Secure permits for conservation volunteering with indigenous-led forests");
  }
  if (preferences.interests.includes("community")) {
    tips.add("Highlight cooperatives and social enterprises for direct economic impact");
  }

  return Array.from(tips);
}

function buildComposerPrompt(preferences: Required<PlannerRequest>, summary: string, tips: string[]) {
  const monthLabel = formatMonthLabel(preferences.travelMonth);
  const interestLine =
    preferences.interests.length > 0
      ? `Interests to center: ${preferences.interests.map((item) => item.replace(/-/g, " ")).join(", ")}.`
      : "";
  const notesLine = preferences.notes ? `Special considerations: ${preferences.notes}.` : "";
  const tipsLine = tips.length > 0 ? `Honor these sustainability guardrails: ${tips.join("; ")}.` : "";

  return [
    `You are the EcoTrips router agent helping craft a ${preferences.nights}-night itinerary for ${preferences.travelers} travelers.`,
    `Destination focus: ${preferences.destination} in ${monthLabel}. ${interestLine}`,
    tipsLine,
    notesLine,
    summary,
    "Return a structured plan with daily highlights, recommended suppliers, and validation steps before booking.",
  ]
    .filter((line) => line.trim().length > 0)
    .join("\n");
}

function ensureDomainKey(request: Request) {
  if (!DOMAIN_KEY) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "CHATKIT_DOMAIN_KEY missing" }, { status: 500 }) };
  }

  const provided = request.headers.get("x-chatkit-domain-key");
  if (!provided || provided !== DOMAIN_KEY) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "invalid_domain_key" }, { status: 403 }) };
  }

  return { ok: true } as const;
}

export async function POST(request: Request) {
  const domainCheck = ensureDomainKey(request);
  if (!domainCheck.ok) {
    return domainCheck.response;
  }

  let body: PlannerRequest | null = null;
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      body = (await request.json()) as PlannerRequest;
    }
  } catch (error) {
    console.error("Invalid planner payload", error);
    return NextResponse.json({ ok: false, error: "invalid_json" } satisfies ErrorResponse, { status: 400 });
  }

  const destination = normalizeText(body?.destination);
  const travelMonth = normalizeText(body?.travelMonth);
  const nights = normalizeNumber(body?.nights, 4);
  const travelers = normalizeNumber(body?.travelers, 2);
  const carbonFocus = normalizeText(body?.carbonFocus, "low-emission");
  const mobilitySupport = normalizeText(body?.mobilitySupport, "None");
  const interests = normalizeInterests(body?.interests, []);
  const notes = normalizeText(body?.notes);

  const issues: string[] = [];
  if (!destination) {
    issues.push("destination is required");
  }
  if (!travelMonth) {
    issues.push("travelMonth is required");
  }

  if (issues.length > 0) {
    return NextResponse.json({ ok: false, error: "validation_error", issues } satisfies ErrorResponse, { status: 400 });
  }

  const preferences: Required<PlannerRequest> = {
    destination,
    travelMonth,
    nights,
    travelers,
    carbonFocus,
    mobilitySupport,
    interests,
    notes,
  };

  const highlights = buildHighlights(preferences);
  const sustainabilityTips = buildSustainabilityTips(preferences);
  const summary = `EcoTrips concierge brief: ${preferences.travelers} travelers, ${preferences.nights} nights in ${preferences.destination} (${formatMonthLabel(preferences.travelMonth)}).`;
  const composerPrompt = buildComposerPrompt(preferences, summary, sustainabilityTips);

  return NextResponse.json({
    ok: true,
    summary,
    composerPrompt,
    highlights,
    sustainabilityTips,
  } satisfies PlannerResponse);
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "method_not_allowed" } satisfies ErrorResponse, { status: 405 });
}
