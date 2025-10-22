"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@ecotrips/ui";
import { InventorySearchInput } from "@ecotrips/types";

import { useAppStore } from "../../../lib/state/appStore";

export function SearchForm() {
  const router = useRouter();
  const [destination, setDestination] = useState("Kigali");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const setSearchInput = useAppStore((state) => state.setSearchInput);
  const setSearchResults = useAppStore((state) => state.setSearchResults);

  const submit = () => {
    const result = InventorySearchInput.safeParse({
      destination,
      startDate: startDate || new Date().toISOString().slice(0, 10),
      endDate: endDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      party: { adults, children },
    });

    if (!result.success) {
      setError("Check your travel dates and party size.");
      return;
    }

    const params = new URLSearchParams({
      destination: result.data.destination,
      startDate: result.data.startDate,
      endDate: result.data.endDate,
      adults: String(result.data.party.adults),
      children: String(result.data.party.children ?? 0),
    });
    setSearchInput(result.data);
    setSearchResults(null);
    router.push(`/results?${params.toString()}`);
  };

  return (
    <div className="space-y-4">
      <label className="flex flex-col gap-2 text-sm">
        <span>Destination</span>
        <input
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400"
          placeholder="Akagera, Nyungwe, Kigali..."
        />
      </label>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <label className="flex flex-col gap-2">
          <span>Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span>End date</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <label className="flex flex-col gap-2">
          <span>Adults</span>
          <input
            type="number"
            min={1}
            value={adults}
            onChange={(event) => setAdults(Number(event.target.value))}
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span>Children</span>
          <input
            type="number"
            min={0}
            value={children}
            onChange={(event) => setChildren(Number(event.target.value))}
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </label>
      </div>
      {error && <p className="text-sm text-rose-200">{error}</p>}
      <Button fullWidth onClick={submit}>
        Search inventory
      </Button>
    </div>
  );
}
