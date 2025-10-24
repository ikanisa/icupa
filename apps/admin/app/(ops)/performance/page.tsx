import { CardGlass } from "@ecotrips/ui";
import type { FlagConfigEntry } from "@ecotrips/types";

import { getOpsFunctionClient } from "../../../lib/functionClient";

async function loadFlagMetrics(): Promise<{
  flags: FlagConfigEntry[];
  offline: boolean;
  requestId?: string;
  forwarded?: number;
}> {
  const client = await getOpsFunctionClient();
  if (!client) {
    return { flags: [], offline: true };
  }

  try {
    const response = await client.call("flags.config", {});
    if (!response.ok) {
      return { flags: [], offline: true, requestId: response.request_id };
    }
    return {
      flags: Array.isArray(response.flags) ? response.flags : [],
      offline: false,
      requestId: response.request_id,
      forwarded: response.analytics_forwarded,
    };
  } catch (error) {
    console.error("flags.config", error);
    return { flags: [], offline: true };
  }
}

export default async function PerformancePage() {
  const metrics = await loadFlagMetrics();

  return (
    <CardGlass
      title="Feature flag analytics"
      subtitle="flags-config emits variant exposure metrics for ops experiments."
    >
      {metrics.offline ? (
        <p className="text-sm text-white/70">
          flags-config offline or unauthorized. Verify Supabase access and retry.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-300/80">
                <th className="pb-3">Flag</th>
                <th className="pb-3">Variant</th>
                <th className="pb-3">Exposure %</th>
                <th className="pb-3">Conversions</th>
                <th className="pb-3">Uplift</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {metrics.flags.flatMap((flag) => {
                if (!Array.isArray(flag.variants) || flag.variants.length === 0) {
                  return [
                    <tr key={`${flag.key}-empty`}>
                      <td className="py-3 font-semibold">{flag.key}</td>
                      <td className="py-3 text-white/70" colSpan={4}>
                        No variant metrics available.
                      </td>
                    </tr>,
                  ];
                }
                return flag.variants.map((variant) => (
                  <tr key={`${flag.key}-${variant.name}`}>
                    <td className="py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold">{flag.key}</span>
                        <span className="text-xs text-white/60">{flag.description ?? ""}</span>
                      </div>
                    </td>
                    <td className="py-3">{variant.name}</td>
                    <td className="py-3">{Math.round((variant.exposure ?? 0) * 100)}%</td>
                    <td className="py-3">{variant.conversions}</td>
                    <td className="py-3">{formatUplift(variant.uplift)}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}
      {typeof metrics.forwarded === "number" && (
        <p className="mt-4 text-xs text-white/60">Forwarded {metrics.forwarded} variant metrics to analytics bus.</p>
      )}
      {metrics.requestId && (
        <p className="mt-2 text-xs text-white/50">Request ID {metrics.requestId}</p>
      )}
    </CardGlass>
  );
}

function formatUplift(value: number | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0%";
  }
  const percent = Math.round(value * 1000) / 10;
  return `${percent}%`;
}
