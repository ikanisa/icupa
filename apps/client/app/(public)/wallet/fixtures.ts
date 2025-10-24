import {
  ConciergeDailyBriefResponse,
  SafetyAdvisoryResponse,
  TimeToLeaveResponse,
} from "@ecotrips/types";

export const fallbackDailyBrief: ConciergeDailyBriefResponse = {
  ok: true,
  request_id: "fixture-daily-brief",
  source: "fixtures",
  itinerary_id: "ITN-2025-001",
  traveler_names: ["Aline", "Ethan"],
  timezone: "Africa/Kigali",
  briefs: [
    {
      day: 2,
      date: "2025-10-01",
      headline: "Arrival in Musanze & permit briefing",
      summary:
        "Concierge confirms trackers, sunset briefing, and standby driver Aline with Land Cruiser.",
      segments: [
        {
          id: "seg-prep",
          time_window: "17:30-18:00",
          title: "Check in at Sabyinyo Silverback Lodge",
          instruction: "Drop bags and meet concierge liaison Claudine in the lounge for welcome tea.",
          contact: { name: "Claudine", role: "Lodge concierge", phone: "+250-788-123-456" },
          notes: [],
        },
        {
          id: "seg-briefing",
          time_window: "18:15-19:00",
          title: "Permit briefing",
          instruction: "Emmanuel will review gorilla permits and collect passports for overnight validation.",
          contact: { name: "Emmanuel", role: "RDB guide", phone: "+250-788-000-000" },
          notes: ["Sign liability waiver", "Confirm packed breakfast from lodge"],
          map_link: "https://maps.app.goo.gl/briefing-hall",
        },
      ],
      alerts: [
        {
          id: "alert-curfew",
          type: "curfew",
          message: "Avoid travel after 21:00. Driver will remain onsite for late arrivals.",
          severity: "moderate",
        },
      ],
      group_savings: {
        escrow_id: "escrow-kinigi",
        target_cents: 4500000,
        collected_cents: 3200000,
        due_date: "2025-10-02",
        nudge_copy: "Need RWF 1.3M to lock-in Virunga shuttles. Share group link tonight.",
        next_step: "Share WhatsApp reminder after permit briefing.",
      },
    },
    {
      day: 3,
      date: "2025-10-02",
      headline: "Gorilla trek & Kigali transfer",
      summary:
        "Early departure for Kinigi HQ, trek with Sabyinyo troop, lunch in Musanze then sunset transfer to Kigali.",
      segments: [
        {
          id: "seg-depart",
          time_window: "05:15-05:30",
          title: "Meet driver in lodge lobby",
          instruction:
            "Carry passports, permits, and packed breakfast; concierge will stage rain ponchos by reception.",
          contact: { name: "Aline", role: "Driver", phone: "+250-788-555-222" },
          notes: ["Thermal check at park gate", "Cash tips optional"],
        },
        {
          id: "seg-trek",
          time_window: "07:00-12:00",
          title: "Gorilla trek with Silverback family",
          instruction: "Trackers Pascal & Keza assigned; expect steep muddy sections—gloves provided.",
          map_link: "https://maps.app.goo.gl/gorilla-trek",
          safety_note: "Maintain 7m distance from troop and follow guide instructions.",
          notes: [],
        },
        {
          id: "seg-transfer",
          time_window: "15:00-17:30",
          title: "Transfer to Kigali Marriott",
          instruction:
            "Concierge pre-check-in complete; expect dusk arrival, hotel will hold dinner until 21:00.",
          notes: ["Refuel at Ruhengeri Total", "Share ETA with concierge"],
          contact: { name: "Front desk", role: "Kigali Marriott", phone: "+250-788-111-444" },
        },
      ],
      alerts: [
        {
          id: "alert-weather",
          type: "weather",
          message: "Light rain expected after 11:00 near Volcanoes NP. Waterproof boots recommended.",
          severity: "moderate",
        },
      ],
      group_savings: {
        escrow_id: "escrow-kinigi",
        target_cents: 4500000,
        collected_cents: 3900000,
        due_date: "2025-10-03",
        nudge_copy: "Only RWF 600k left for Kigali dining upgrade. Encourage last two contributors tonight.",
        next_step: "Schedule follow-up ping 24h before due date.",
      },
    },
  ],
};

export const fallbackTimeToLeave: TimeToLeaveResponse = {
  ok: true,
  request_id: "fixture-time-to-leave",
  source: "fixtures",
  itinerary_id: "ITN-2025-001",
  timezone: "Africa/Kigali",
  next_departure: "kinigi-briefing",
  departures: [
    {
      id: "kinigi-briefing",
      label: "Permit check-in at Kinigi HQ",
      recommended_departure: "2025-10-02T05:15:00+02:00",
      window_minutes: 10,
      buffer_minutes: 20,
      pickup_point: "Sabyinyo Silverback Lodge lobby",
      status: "on_track",
      transport: {
        provider: "Volcanoes Fleet",
        vehicle: "Toyota Land Cruiser",
        driver: "Aline",
        contact_phone: "+250-788-555-222",
      },
      notes: [
        "Allow 45 minutes for Kinigi HQ briefing",
        "Driver will stage ponchos in vehicle",
      ],
    },
    {
      id: "kigali-transfer",
      label: "Transfer to Kigali Marriott",
      recommended_departure: "2025-10-02T15:00:00+02:00",
      window_minutes: 15,
      buffer_minutes: 25,
      pickup_point: "Virunga Cafe parking",
      status: "monitor",
      transport: {
        provider: "Volcanoes Fleet",
        vehicle: "Toyota Land Cruiser",
        driver: "Aline",
        contact_phone: "+250-788-555-222",
      },
      notes: [
        "Roadworks near Kagitumba require extra buffer",
        "Concierge will confirm hotel ETA at 16:30",
      ],
    },
  ],
};

export const fallbackSafety: SafetyAdvisoryResponse = {
  ok: true,
  request_id: "fixture-safety",
  source: "fixtures",
  itinerary_id: "ITN-2025-001",
  region: "Volcanoes National Park",
  provider: "ConciergeGuide",
  advisories: [
    {
      id: "weather-volcanoes-20251002",
      level: "moderate",
      title: "Afternoon thunderstorms near Kinigi",
      summary: "Rwanda Meteorology projects rain bands from 14:00-18:00 with slippery trails.",
      details:
        "Carry waterproof boots and gloves. Trek duration may extend by 30 minutes if troop relocates downhill.",
      effective_from: "2025-10-02T12:00:00+02:00",
      effective_to: "2025-10-02T18:30:00+02:00",
      actions: [
        "Confirm ponchos packed before departure",
        "Share ETA updates with concierge if trek extends",
      ],
      channels: ["wallet_modal", "whatsapp_broadcast"],
      external_reference: "https://www.meteorwanda.gov.rw/forecast",
    },
    {
      id: "security-ruhondo-bridge",
      level: "low",
      title: "Speed checkpoint near Ruhondo bridge",
      summary: "Local police operating 40 km/h checkpoint between Musanze and Kigali after 16:00.",
      details:
        "Driver briefed to carry insurance docs and trip manifest. Expect a 5 minute stop for verification.",
      effective_from: "2025-10-02T15:30:00+02:00",
      effective_to: "2025-10-02T21:00:00+02:00",
      actions: [
        "Keep passports accessible for inspection",
        "Message concierge if stop exceeds 10 minutes",
      ],
      channels: ["wallet_modal", "sms_backup"],
    },
  ],
};
