"use client";

import { useMemo, useState } from "react";
import { CardGlass, buttonClassName } from "@ecotrips/ui";

type KeyStatus = "active" | "suspended" | "revoked" | string;

type B2BKeySummary = {
  id: string;
  name: string;
  status: KeyStatus;
  scopes: string[];
  maskedKey: string;
  createdAt: string;
  lastUsedAt: string | null;
  usageCount: number;
  revokedAt?: string | null;
  revokedReason?: string | null;
};

type Props = {
  initialKeys: B2BKeySummary[];
};

export default function B2BKeysPanel({ initialKeys }: Props) {
  const [keys, setKeys] = useState(initialKeys);
  const [ephemeralSecret, setEphemeralSecret] = useState<string | null>(null);

  const statusClassName = (status: KeyStatus) => {
    if (status === "active") {
      return buttonClassName("glass");
    }
    if (status === "suspended") {
      return buttonClassName("secondary", false, "border border-amber-400/60 text-amber-200 bg-transparent");
    }
    return buttonClassName("secondary", false, "border border-rose-500/60 text-rose-200 bg-transparent");
  };

  const revokeClassName = buttonClassName("secondary", false, "border border-rose-500/60 text-rose-200 hover:bg-rose-500/10");

  const activeCount = useMemo(
    () => keys.filter((key) => key.status === "active").length,
    [keys],
  );

  const handleCreate = () => {
    const now = new Date();
    const mockId = crypto.randomUUID();
    const prefix = `eco_${now.getUTCFullYear()}${(now.getUTCMonth() + 1).toString().padStart(2, "0")}`;
    const random = crypto.randomUUID().replace(/-/g, "").slice(0, 18);
    const secret = `${prefix}_${random}`;
    const newKey: B2BKeySummary = {
      id: mockId,
      name: "Mock partner key",
      status: "active",
      scopes: ["inventory.read", "leads.write"],
      maskedKey: `${secret.slice(0, 12)}••••`,
      createdAt: now.toISOString(),
      lastUsedAt: null,
      usageCount: 0,
    };
    setKeys((prev) => [newKey, ...prev]);
    setEphemeralSecret(secret);
  };

  const handleRevoke = (id: string) => {
    setKeys((prev) =>
      prev.map((key) =>
        key.id === id
          ? {
            ...key,
            status: "revoked",
            revokedAt: new Date().toISOString(),
            revokedReason: key.revokedReason ?? "Revoked via console (mock)",
          }
          : key,
      )
    );
  };

  return (
    <CardGlass
      title="B2B API keys"
      subtitle="Mock create/revoke controls; production flows should call the secure admin functions."
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-white/70">
              Active keys: <strong>{activeCount}</strong>
            </p>
            <p className="text-xs text-white/50">
              Keys are masked to the first 12 characters. Rotate secrets via infra runbooks.
            </p>
          </div>
          <button
            type="button"
            className={buttonClassName("glass")}
            onClick={handleCreate}
          >
            Create partner key
          </button>
        </div>

        {ephemeralSecret && (
          <div className="rounded-2xl border border-emerald-400/50 bg-emerald-500/10 p-4 text-sm">
            <p className="font-semibold text-emerald-200">Mock secret (not persisted):</p>
            <code className="block break-all text-emerald-100">{ephemeralSecret}</code>
            <p className="mt-2 text-emerald-100/80">
              Provide this secret only once. Store it in your vault and exchange via secure channel.
            </p>
          </div>
        )}

        {keys.length === 0 ? (
          <p className="text-sm text-white/70">
            No keys provisioned yet. Use the infra automation to mint partner credentials.
          </p>
        ) : (
          <ul className="space-y-4 text-sm">
            {keys.map((key) => (
              <li
                key={key.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold text-white">{key.name}</p>
                    <p className="text-white/70">{key.maskedKey}</p>
                    <div className="flex flex-wrap gap-2">
                      {key.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-white/70"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-white/50">
                      Created {new Date(key.createdAt).toLocaleString()} · Usage {key.usageCount}
                      {key.lastUsedAt ? ` · Last used ${new Date(key.lastUsedAt).toLocaleString()}` : ""}
                    </p>
                    {key.status === "revoked" && (
                      <p className="text-xs text-rose-300">
                        Revoked {key.revokedAt ? new Date(key.revokedAt).toLocaleString() : "recently"}
                        {key.revokedReason ? ` — ${key.revokedReason}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={statusClassName(key.status)}>
                      {key.status}
                    </span>
                    {key.status === "active" ? (
                      <button
                        type="button"
                        className={revokeClassName}
                        onClick={() => handleRevoke(key.id)}
                      >
                        Revoke
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CardGlass>
  );
}

export type { B2BKeySummary };
