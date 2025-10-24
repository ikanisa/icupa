"use client";

import { useEffect, useState } from "react";

import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

type Ping = { ok: boolean; message: string };

export default function AtlasCheck() {
  const [status, setStatus] = useState<Ping | null>(null);

  useEffect(() => {
    // Simple env check; we’re not querying tables yet.
    try {
      const supabase = getSupabaseBrowser();
      if (supabase) {
        setStatus({ ok: true, message: "Supabase env loaded (browser client ready)" });
      }
    } catch (e: any) {
      setStatus({ ok: false, message: e?.message || "Env error" });
    }
  }, []);

  return (
    <div className="card">
      <div className="h1">Atlas Shell ✓</div>
      <p className="subtle">Dark canvas, quiet panels, rounded shapes, soft borders — Atlas look applied.</p>
      <div className="row" style={{ marginTop: 12 }}>
        <span className="badge">Env</span>
        <span>{status ? (status.ok ? "Ready" : "Problem") : "Checking..."}</span>
      </div>
      {status && (
        <div className={`toast ${status.ok ? "" : "error"}`} role="status" aria-live="polite">
          {status.message}
        </div>
      )}
      <div style={{ marginTop: 16 }} className="row">
        <button className="btn btn-primary" onClick={() => location.reload()}>Reload</button>
        <button className="btn" onClick={() => history.back()}>Back</button>
      </div>
    </div>
  );
}
