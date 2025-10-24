"use client";

import { useEffect, useState } from "react";
import { Button } from "@ecotrips/ui";
import { createEcoTripsFunctionClient } from "@ecotrips/api";
import type { SosContact } from "@ecotrips/types";

import { captureClientEvent } from "../../../lib/analytics";

const clientPromise = (async () => {
  if (typeof window === "undefined") return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;
  return createEcoTripsFunctionClient({
    supabaseUrl,
    anonKey,
    getAccessToken: async () => null,
  });
})();

const fallbackContacts: SosContact[] = [
  {
    id: "sos-rwanda-duty",
    label: "Duty manager — Kigali",
    phone: "+250 788 000 111",
    channel: "voice",
    timezone: "Africa/Kigali",
    languages: ["rw", "en"],
    notes: "On-call overnight; escalation to GM after 3 rings.",
  },
  {
    id: "sos-ranger",
    label: "Park ranger desk",
    phone: "+250 732 555 010",
    channel: "voice",
    timezone: "Africa/Kigali",
    languages: ["rw", "fr", "en"],
    notes: "Coordinates gorilla trek contingencies.",
  },
  {
    id: "sos-whatsapp",
    label: "Concierge WhatsApp",
    phone: "+250 789 123 456",
    channel: "whatsapp",
    timezone: "Africa/Kigali",
    languages: ["en"],
    notes: "24/7 monitoring with auto-escalation for SOS keyword.",
  },
];

type SosCardState = {
  contacts: SosContact[];
  loading: boolean;
};

export function SosCard() {
  const [state, setState] = useState<SosCardState>({ contacts: fallbackContacts, loading: true });

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const client = await clientPromise;
        if (!client) {
          setState({ contacts: fallbackContacts, loading: false });
          captureClientEvent("sos_viewed", { mode: "offline" });
          return;
        }
        const response = await client.support.sosContacts();
        const contacts = response.contacts?.length ? response.contacts : fallbackContacts;
        if (!active) return;
        setState({ contacts, loading: false });
        captureClientEvent("sos_viewed", { mode: response.request_id ? "edge" : "offline" });
      } catch (error) {
        console.error("support.sosContacts", error);
        if (!active) return;
        setState({ contacts: fallbackContacts, loading: false });
        captureClientEvent("sos_viewed", { mode: "error" });
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const handleCall = async (contact: SosContact) => {
    captureClientEvent("sos_called", { contactId: contact.id, channel: contact.channel });
    try {
      const client = await clientPromise;
      await client?.support.sosAction({ contact_id: contact.id, action: "call" });
    } catch (error) {
      console.error("support.sosAction", error);
    }
  };

  const handleShare = async (contact: SosContact) => {
    captureClientEvent("sos_share_attempt", { contactId: contact.id });
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "ecoTrips SOS contact",
          text: `${contact.label} — ${contact.phone}`,
        });
        captureClientEvent("sos_share_completed", { contactId: contact.id });
      } catch (error) {
        console.error("share_failed", error);
      }
    }
  };

  return (
    <div className="space-y-4">
      {state.contacts.map((contact) => (
        <div key={contact.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-col gap-1">
            <p className="text-base font-semibold text-white">{contact.label}</p>
            <p className="text-sm text-white/70">{contact.phone}</p>
            {contact.notes && <p className="text-xs text-white/60">{contact.notes}</p>}
            <p className="text-xs text-white/50">
              Channel: {contact.channel.toUpperCase()} · Languages: {contact.languages?.join(", ") ?? "en"}
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="glass" onClick={() => handleCall(contact)}>
              <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}>Call now</a>
            </Button>
            <Button variant="secondary" onClick={() => handleShare(contact)}>
              Share contact
            </Button>
          </div>
        </div>
      ))}
      {state.loading && <p className="text-xs text-white/60">Loading SOS roster…</p>}
    </div>
  );
}
