"use client";

import { useState } from "react";
import { Button, CardGlass } from "@ecotrips/ui";
import { clsx } from "clsx";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || !password) {
      setMessage("Provide both email and password to continue.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setMessage("Check your inbox for a magic link. Portal access is limited to verified suppliers.");
    } catch (error) {
      console.error("supplier.login", error);
      setMessage("Login unavailable. Try again shortly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <CardGlass
      title="Supplier sign-in"
      subtitle="Access confirmed orders, traveler manifests, and sustainability metrics."
      className="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="supplier-email" className="text-sm font-medium text-slate-100/90">
            Work email
          </label>
          <input
            id="supplier-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@lodgelink.com"
            className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/40"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="supplier-password" className="text-sm font-medium text-slate-100/90">
            Password
          </label>
          <input
            id="supplier-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-2 text-sm text-white outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-400/40"
          />
        </div>
        <Button type="submit" variant="glass" fullWidth disabled={loading}>
          {loading ? "Sending magic link…" : "Send login link"}
        </Button>
        <p className={clsx("text-xs", message ? "text-emerald-200/80" : "text-slate-200/60")}>{message ?? "Access limited to approved ecoTrips partners."}</p>
      </form>
    </CardGlass>
  );
}
