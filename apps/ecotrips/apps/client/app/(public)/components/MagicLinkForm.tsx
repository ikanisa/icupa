"use client";

import { FormEvent, useMemo, useState } from "react";
import { Button, Toast } from "@ecotrips/ui";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

interface MagicLinkFormProps {
  redirectPath?: string;
  title?: string;
}

type ToastState = { id: string; title: string; description?: string } | null;

export function MagicLinkForm({ redirectPath = "/", title }: MagicLinkFormProps) {
  const [email, setEmail] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [pending, setPending] = useState(false);

  const supabase = useMemo(() => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return null;
    }

    return createClientComponentClient({
      supabaseUrl,
      supabaseKey: anonKey,
    });
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase) {
      setToast({
        id: "config-missing",
        title: "Configuration needed",
        description: "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      });
      return;
    }

    if (!email) {
      setToast({ id: "email-required", title: "Email required", description: "Enter your email to continue." });
      return;
    }

    setPending(true);
    setToast(null);

    try {
      const origin = typeof window !== "undefined" ? window.location.origin : undefined;
      const emailRedirectTo = origin
        ? `${origin}/api/auth/callback?next=${encodeURIComponent(redirectPath)}`
        : undefined;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo,
        },
      });

      if (error) {
        setToast({
          id: "error",
          title: "Sign-in failed",
          description: error.message ?? "Unable to send magic link.",
        });
        return;
      }

      setToast({
        id: "sent",
        title: title ?? "Magic link sent",
        description: "Check your inbox to complete sign-in.",
      });
      setEmail("");
    } catch (error) {
      console.error("magic_link.submit", error);
      setToast({
        id: "error",
        title: "Unexpected error",
        description: error instanceof Error ? error.message : "Unable to request magic link.",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-sm">
        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-[0.2em] text-white/70">Work email</span>
          <input
            type="email"
            name="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ops@ecotrips.africa"
            autoComplete="email"
            className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-base text-white placeholder-white/50 shadow-inset focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </label>
        <Button type="submit" variant="glass" disabled={pending} className="w-full justify-center">
          {pending ? "Sending magic link…" : "Send magic link"}
        </Button>
      </form>
      <div className="fixed bottom-24 left-1/2 z-40 w-full max-w-sm -translate-x-1/2">
        {toast && <Toast id={toast.id} title={toast.title} description={toast.description} onDismiss={() => setToast(null)} />}
      </div>
    </>
  );
}
