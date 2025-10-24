"use client";

import { useState } from "react";
import { Button, Toast } from "@ecotrips/ui";
import { PrivacyExportInput } from "@ecotrips/types";

import { useOptionalFunctionClient } from "../../../lib/api/client-provider";

type ToastState = { id: string; title: string; description?: string } | null;

export function WalletOfflinePack() {
  const [requestId, setRequestId] = useState("");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [pending, setPending] = useState(false);
  const optionalClient = useOptionalFunctionClient();

  const invoke = async () => {
    const parsed = PrivacyExportInput.safeParse({ request_id: requestId });
    if (!parsed.success) {
      setToast({ id: "invalid", title: "Request ID required", description: "Use a privacy export request id." });
      return;
    }

    const client = optionalClient;
    if (!client) {
      setToast({ id: "offline", title: "Offline mode", description: "Authenticate to sync offline packs." });
      return;
    }

    setPending(true);
    try {
      const response = await client.call("privacy.export", parsed.data);
      if (response.ok && response.signed_url) {
        setDownloadUrl(response.signed_url);
        setToast({ id: "ready", title: "Offline pack ready", description: "Signed URL generated." });
      } else {
        setToast({ id: "error", title: "Export pending", description: "Request still processing or failed." });
      }
    } catch (error) {
      console.error("privacy.export", error);
      setToast({ id: "error", title: "Export failed", description: "Check privacy export function logs." });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-4">
      <label className="flex flex-col gap-2 text-sm">
        <span>Privacy request ID</span>
        <input
          value={requestId}
          onChange={(event) => setRequestId(event.target.value)}
          placeholder="uuid for privacy export request"
          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-sky-400"
        />
      </label>
      <Button onClick={invoke} disabled={pending}>
        {pending ? "Generating…" : "Generate offline pack"}
      </Button>
      {downloadUrl && (
        <p className="text-sm text-sky-200">
          Signed URL available for 60m: <a className="underline" href={downloadUrl}>{downloadUrl}</a>
        </p>
      )}
      <div className="fixed bottom-24 left-1/2 z-50 w-full max-w-sm -translate-x-1/2">
        {toast && <Toast id={toast.id} title={toast.title} description={toast.description} onDismiss={() => setToast(null)} />}
      </div>
    </div>
  );
}
