"use client";

import { useState } from "react";
import { Button } from "@ecotrips/ui";

import type { PushDelivery } from "@ecotrips/types";
import { logAdminAction } from "../../../lib/logging";

type PushSendMockProps = {
  deliveries: PushDelivery[];
};

type MockState = {
  title: string;
  body: string;
  tags: string;
  dryRun: boolean;
  result: PushDelivery[];
};

export function PushSendMock({ deliveries }: PushSendMockProps) {
  const [state, setState] = useState<MockState>({
    title: "Sunrise trek reminder",
    body: "Pickup remains 05:15 at Virunga Lodge. Tap to confirm.",
    tags: "wallet,search",
    dryRun: false,
    result: deliveries,
  });

  const handleSend = () => {
    const payload = {
      title: state.title,
      body: state.body,
      tags: state.tags.split(",").map((entry) => entry.trim()).filter(Boolean),
      dryRun: state.dryRun,
    };
    console.log("notify.push.send.mock", payload);
    logAdminAction("engagement.push_send", { mode: "mock", payload });
    setState((prev) => ({ ...prev, result: deliveries }));
  };

  return (
    <div className="space-y-4">
      <label className="flex flex-col gap-2 text-sm">
        <span>Title</span>
        <input
          value={state.title}
          onChange={(event) => setState((prev) => ({ ...prev, title: event.target.value }))}
          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm">
        <span>Body</span>
        <textarea
          value={state.body}
          onChange={(event) => setState((prev) => ({ ...prev, body: event.target.value }))}
          rows={3}
          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm">
        <span>Tags</span>
        <input
          value={state.tags}
          onChange={(event) => setState((prev) => ({ ...prev, tags: event.target.value }))}
          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-white/80">
        <input
          type="checkbox"
          checked={state.dryRun}
          onChange={(event) => setState((prev) => ({ ...prev, dryRun: event.target.checked }))}
          className="h-4 w-4"
        />
        Dry run (skip delivery)
      </label>
      <Button onClick={handleSend}>Send mock push</Button>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/80">
        <p className="mb-2 font-semibold text-white">Delivery preview</p>
        <ul className="space-y-2">
          {state.result.map((delivery) => (
            <li key={delivery.subscription_id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="font-medium text-white">{delivery.endpoint}</p>
              <p>Status: {delivery.status}</p>
              {delivery.error && <p className="text-rose-200">Error: {delivery.error}</p>}
              <p className="text-white/50">Latency {delivery.latency_ms} ms</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
