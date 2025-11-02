"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@icupa/ui/button";
import { Input } from "@icupa/ui/input";
import { Card } from "@icupa/ui/card";
import { Alert, AlertDescription } from "@icupa/ui/alert";
import { toast } from "@icupa/ui/use-toast";
import { supabase } from "@/lib/supabase-client";

const gradientBackdrop = "bg-[radial-gradient(circle_at_top,_rgba(163,118,255,0.16),_rgba(15,12,40,0.94))]";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      if (data.session) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.session.user.id)
          .eq("role", "admin")
          .maybeSingle();
        if (roles) {
          router.replace("/admin");
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setStatusMessage("Enter your admin email address.");
      return;
    }
    setSending(true);
    setStatusMessage("Sending magic link…");
    try {
      const { error } = await supabase.functions.invoke("auth/admin_email_magiclink", {
        body: { email: trimmed },
      });
      if (error) {
        throw new Error(error.message);
      }
      toast({
        title: "Magic link sent",
        description: "Check your inbox and follow the link to finish signing in.",
      });
      setStatusMessage("Magic link sent. Check your email.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send magic link.";
      setStatusMessage(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`min-h-screen ${gradientBackdrop} flex items-center justify-center px-6 py-16`}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <Card className="glass-card w-full max-w-md border border-white/10 bg-black/40 p-8 text-white shadow-xl backdrop-blur">
          <div className="space-y-3 text-center">
            <h1 className="text-3xl font-semibold tracking-tight">Admin Sign In</h1>
            <p className="text-sm text-white/70">
              Enter your ICUPA admin email and we’ll send you a secure magic link.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-10 space-y-6">
            <div className="space-y-2 text-left">
              <label htmlFor="admin-email" className="text-xs uppercase tracking-[0.3em] text-white/60">
                Email address
              </label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ops@icupa.example"
                className="border-white/10 bg-white/10 text-white placeholder:text-white/40"
              />
            </div>
            <Button
              type="submit"
              className="w-full rounded-full bg-gradient-to-r from-primary to-violet-500 text-black hover:brightness-110"
              disabled={sending}
            >
              {sending ? "Sending…" : "Send magic link"}
            </Button>
          </form>

          {statusMessage && (
            <Alert variant="default" className="mt-6 border-white/10 bg-white/10 text-white">
              <AlertDescription>{statusMessage}</AlertDescription>
            </Alert>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
