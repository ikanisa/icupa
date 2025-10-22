"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Toast } from "@ecotrips/ui";
import { ContributionCreate, EscrowCreate } from "@ecotrips/types";

import { useOptionalFunctionClient } from "../../../lib/api/client-provider";

type ToastState = { id: string; title: string; description?: string } | null;

type GroupEscrowActionsProps = {
  itineraryId: string;
};

export function GroupEscrowActions({ itineraryId }: GroupEscrowActionsProps) {
  const [toast, setToast] = useState<ToastState>(null);
  const [pendingCreate, startCreate] = useTransition();
  const [pendingContribute, startContribute] = useTransition();
  const optionalClient = useOptionalFunctionClient();

  const defaultDeadline = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date.toISOString().slice(0, 10);
  }, []);

  const [name, setName] = useState("EcoTrips Escrow");
  const [target, setTarget] = useState(250000);
  const [currency, setCurrency] = useState("USD");
  const [deadline, setDeadline] = useState(defaultDeadline);

  const [escrowId, setEscrowId] = useState<string>("");
  const [contributionName, setContributionName] = useState("Guest");
  const [contributionAmount, setContributionAmount] = useState(50000);

  const showToast = (state: ToastState) => {
    setToast(state);
    if (state) {
      setTimeout(() => setToast(null), 5000);
    }
  };

  const createEscrow = async () => {
    const payload = EscrowCreate.safeParse({
      name,
      targetAmountCents: target,
      currency: currency.toUpperCase(),
      deadline,
      itineraryId,
    });
    if (!payload.success) {
      showToast({ id: "invalid", title: "Fix escrow inputs", description: "Name, amount, and deadline required." });
      return;
    }

    const client = optionalClient;
    if (!client) {
      showToast({ id: "offline", title: "Offline mode", description: "Authenticate to reach Supabase functions." });
      return;
    }

    try {
      const response = await client.call("groups.create", payload.data);
      if (response.ok && response.escrow_id) {
        setEscrowId(response.escrow_id);
        showToast({ id: "created", title: "Escrow created", description: `Escrow ${response.escrow_id}` });
      } else {
        showToast({ id: "error", title: "Escrow failed", description: "Check INVENTORY_OFFLINE toggle." });
      }
    } catch (error) {
      console.error("groups.create", error);
      showToast({ id: "error", title: "Escrow failed", description: "Falling back to fixture list." });
    }
  };

  const contribute = async () => {
    const activeEscrow = escrowId || itineraryId;
    const payload = ContributionCreate.safeParse({
      escrowId: activeEscrow,
      amountCents: contributionAmount,
      currency: currency.toUpperCase(),
      contributorName: contributionName,
      idempotencyKey: `contrib-${activeEscrow}`,
    });
    if (!payload.success) {
      showToast({ id: "invalid", title: "Invalid contribution", description: "Enter valid name and amount." });
      return;
    }

    const client = optionalClient;
    if (!client) {
      showToast({ id: "offline", title: "Offline mode", description: "Authenticate to sync contributions." });
      return;
    }

    try {
      const response = await client.call("groups.contribute", payload.data);
      if (response.ok && response.contribution_id) {
        showToast({
          id: "contributed",
          title: "Contribution logged",
          description: `Contribution ${response.contribution_id.slice(0, 8)}…`,
        });
      } else {
        showToast({ id: "error", title: "Contribution failed", description: "Retry once connectivity returns." });
      }
    } catch (error) {
      console.error("groups.contribute", error);
      showToast({ id: "error", title: "Contribution failed", description: "Fixtures retained for UX continuity." });
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">Create escrow</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span>Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span>Target (cents)</span>
            <input
              type="number"
              value={target}
              onChange={(event) => setTarget(Number(event.target.value))}
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span>Currency</span>
            <input
              value={currency}
              onChange={(event) => setCurrency(event.target.value.toUpperCase())}
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span>Deadline</span>
            <input
              type="date"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </label>
        </div>
        <Button disabled={pendingCreate} onClick={() => startCreate(createEscrow)}>
          {pendingCreate ? "Creating escrow…" : "Create escrow"}
        </Button>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">Log contribution</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span>Escrow ID</span>
            <input
              value={escrowId}
              placeholder="Auto-filled after creation"
              onChange={(event) => setEscrowId(event.target.value)}
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span>Contributor</span>
            <input
              value={contributionName}
              onChange={(event) => setContributionName(event.target.value)}
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span>Amount (cents)</span>
            <input
              type="number"
              value={contributionAmount}
              onChange={(event) => setContributionAmount(Number(event.target.value))}
              className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </label>
        </div>
        <Button disabled={pendingContribute} onClick={() => startContribute(contribute)}>
          {pendingContribute ? "Logging contribution…" : "Log contribution"}
        </Button>
      </div>

      <div className="fixed bottom-24 left-1/2 z-50 w-full max-w-sm -translate-x-1/2">
        {toast && <Toast id={toast.id} title={toast.title} description={toast.description} onDismiss={() => setToast(null)} />}
      </div>
    </div>
  );
}
