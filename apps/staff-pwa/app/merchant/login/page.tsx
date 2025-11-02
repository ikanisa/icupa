"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@icupa/ui/button";
import { Input } from "@icupa/ui/input";
import { Card } from "@icupa/ui/card";
import { Alert, AlertDescription } from "@icupa/ui/alert";
import { toast } from "@icupa/ui/use-toast";
import { supabase } from "@/lib/supabase-client";

interface VerifyResponse {
  ok: boolean;
  session: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  } | null;
  merchant_profile?: Record<string, unknown>;
}

const gradientBackdrop = "bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_rgba(0,0,0,0.85))]";

function normalisePhone(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("+")) {
    return trimmed;
  }
  if (/^[0-9]+$/.test(trimmed)) {
    return `+${trimmed}`;
  }
  return trimmed;
}

export default function MerchantLoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("+250");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const sendMutation = useMutation({
    mutationFn: async (targetPhone: string) => {
      const { error } = await supabase.functions.invoke("auth/whatsapp_send_otp", {
        body: { phone_e164: targetPhone },
      });

      if (error) {
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast({ title: "Code sent", description: "Check WhatsApp for your 6-digit ICUPA code." });
      setStep("otp");
      setStatusMessage(null);
    },
    onError: (error: Error) => {
      setStatusMessage(error.message);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ targetPhone, code }: { targetPhone: string; code: string }) => {
      const { data, error } = await supabase.functions.invoke<VerifyResponse>(
        "auth/whatsapp_verify_otp",
        {
          body: { phone_e164: targetPhone, otp: code },
        },
      );

      if (error) {
        throw new Error(error.message);
      }

      if (data?.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      return data;
    },
    onSuccess: () => {
      toast({ title: "Signed in", description: "Welcome back to ICUPA Merchant." });
      queryClient.invalidateQueries({ queryKey: ["merchant"] });
      router.replace("/merchant");
    },
    onError: (error: Error) => {
      setStatusMessage(error.message);
    },
  });

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formatted = normalisePhone(phone);
    if (!/^\+[1-9][0-9]{6,14}$/.test(formatted)) {
      setStatusMessage("Enter a valid WhatsApp number in international format.");
      return;
    }
    setStatusMessage("Sending code…");
    await sendMutation.mutateAsync(formatted);
  };

  const handleVerify = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = otp.trim();
    if (!/^\d{6}$/.test(code)) {
      setStatusMessage("Enter the 6-digit code from WhatsApp.");
      return;
    }
    setStatusMessage("Verifying…");
    await verifyMutation.mutateAsync({ targetPhone: normalisePhone(phone), code });
  };

  return (
    <div className={`min-h-screen ${gradientBackdrop} flex items-center justify-center px-6 py-16`}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <Card className="glass-card w-full max-w-md border border-white/10 bg-black/40 p-8 text-white shadow-xl backdrop-blur">
          <div className="space-y-3 text-center">
            <h1 className="text-3xl font-semibold tracking-tight">Merchant Sign In</h1>
            <p className="text-sm text-white/70">
              Authenticate with your verified WhatsApp number to access ICUPA Merchant.
            </p>
          </div>

          <div className="mt-10 space-y-8">
            {step === "phone" ? (
              <form onSubmit={handleSend} className="space-y-6">
                <div className="space-y-2 text-left">
                  <label htmlFor="merchant-phone" className="text-xs uppercase tracking-[0.3em] text-white/60">
                    WhatsApp number
                  </label>
                  <Input
                    id="merchant-phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+250789000000"
                    className="border-white/10 bg-white/10 text-white placeholder:text-white/40"
                    autoComplete="tel"
                  />
                  <p className="text-xs text-white/50">We will send a one-time ICUPA code via WhatsApp.</p>
                </div>
                <Button
                  type="submit"
                  className="w-full rounded-full bg-gradient-to-r from-primary to-violet-500 text-black hover:brightness-110"
                  disabled={sendMutation.isPending}
                >
                  {sendMutation.isPending ? "Sending code..." : "Send OTP"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerify} className="space-y-6">
                <div className="space-y-2 text-left">
                  <label htmlFor="merchant-otp" className="text-xs uppercase tracking-[0.3em] text-white/60">
                    6-digit code
                  </label>
                  <Input
                    id="merchant-otp"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value)}
                    placeholder="123456"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="border-white/10 bg-white/10 text-white tracking-[0.3em] text-center text-2xl"
                  />
                  <p className="text-xs text-white/50">
                    Code sent to {normalisePhone(phone)}. Codes expire after 7 minutes.
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <Button
                    type="submit"
                    className="w-full rounded-full bg-gradient-to-r from-primary to-violet-500 text-black hover:brightness-110"
                    disabled={verifyMutation.isPending}
                  >
                    {verifyMutation.isPending ? "Verifying..." : "Verify & Sign In"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-white/80 hover:bg-white/10"
                    disabled={sendMutation.isPending}
                    onClick={() => sendMutation.mutate(normalisePhone(phone))}
                  >
                    Resend code
                  </Button>
                </div>
              </form>
            )}

            {statusMessage && (
              <Alert variant="default" className="border-white/10 bg-white/10 text-white">
                <AlertDescription>{statusMessage}</AlertDescription>
              </Alert>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
