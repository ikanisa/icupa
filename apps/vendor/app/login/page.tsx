'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  LiquidGlassCard,
} from '@icupa/ui';
import { sendWhatsAppOtp, verifyWhatsAppOtp } from '../../lib/api';
import { useVendorAuth } from '../../lib/auth-context';

const phoneSchema = z.object({
  phone: z
    .string()
    .min(9, 'Enter a valid phone number including country code')
    .regex(/^\+?[1-9]\d{7,14}$/u, 'Use E.164 format e.g. +250788123456'),
});

const otpSchema = z.object({
  otp: z
    .string()
    .min(4, 'Enter the 4–6 digit code')
    .max(6, 'Enter the 4–6 digit code'),
});

type PhoneForm = z.infer<typeof phoneSchema>;
type OtpForm = z.infer<typeof otpSchema>;

export default function VendorLoginPage() {
  const [phoneE164, setPhoneE164] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const { login, isAuthenticated } = useVendorAuth();

  const phoneForm = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
    defaultValues: {
      phone: '+2507',
    },
  });

  const otpForm = useForm<OtpForm>({
    resolver: zodResolver(otpSchema),
    defaultValues: {
      otp: '',
    },
  });

  const sendOtpMutation = useMutation({
    mutationFn: async (data: PhoneForm) => {
      const formatted = data.phone.startsWith('+') ? data.phone : `+${data.phone}`;
      const response = await sendWhatsAppOtp(formatted);
      setPhoneE164(formatted);
      setInfoMessage(
        response.expires_at
          ? `Code sent. It will expire at ${new Date(response.expires_at).toLocaleTimeString()}.`
          : 'Code sent to WhatsApp. Please check your phone.',
      );
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async (data: OtpForm) => {
      if (!phoneE164) {
        throw new Error('Enter your phone number first.');
      }
      const response = await verifyWhatsAppOtp(phoneE164, data.otp);
      await login(phoneE164, response);
      setInfoMessage('Authenticated! Redirecting you to the dashboard…');
    },
  });

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950/70 to-emerald-900 px-6 py-16 text-white">
      <div className="flex w-full max-w-5xl flex-col gap-10 md:flex-row">
        <LiquidGlassCard className="flex-1 space-y-6 p-10 text-white">
          <Badge variant="outline" className="glass-surface border-white/30 bg-white/10 text-white">
            WhatsApp Login
          </Badge>
          <h1 className="text-4xl font-semibold md:text-5xl">Verify it&apos;s really you</h1>
          <p className="text-lg text-white/80">
            Secure vendor access uses a verified WhatsApp number. Enter your number to receive a one-time passcode,
            then confirm it to unlock live orders, menu management, and payout controls.
          </p>
          <div className="space-y-4 text-sm text-white/70">
            <p className="font-semibold uppercase tracking-[0.25em] text-white/60">What you&apos;ll need</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Owner or manager WhatsApp number in E.164 format (e.g. +250788123456)</li>
              <li>SMS/WhatsApp access to receive the 6-digit code</li>
              <li>An active vendor profile (ICUPA will prompt onboarding if missing)</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/5 p-6 text-sm text-white/70">
            <p className="font-semibold text-white">Need help?</p>
            <p>
              Contact ICUPA support via <Link href="mailto:support@icupa.com">support@icupa.com</Link> or visit the
              <Link className="ml-1 underline" href="https://docs.icupa.com/vendors/login">
                vendor onboarding guide
              </Link>
              .
            </p>
          </div>
        </LiquidGlassCard>

        <div className="flex-1 space-y-6">
          <Card className="glass-surface border-white/15 bg-white/10 text-white">
            <CardHeader>
              <CardTitle>1. Send verification code</CardTitle>
              <CardDescription className="text-white/70">
                We&apos;ll send a secure OTP to your WhatsApp number. Codes expire quickly to keep access safe.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="space-y-4"
                onSubmit={phoneForm.handleSubmit((data) => sendOtpMutation.mutate(data))}
              >
                <div className="space-y-2">
                  <Label htmlFor="phone">WhatsApp phone number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+250788123456"
                    className="bg-white/10 text-white placeholder:text-white/40"
                    {...phoneForm.register('phone')}
                    aria-invalid={Boolean(phoneForm.formState.errors.phone)}
                  />
                  {phoneForm.formState.errors.phone && (
                    <p className="text-sm text-rose-300">{phoneForm.formState.errors.phone.message}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={sendOtpMutation.isPending || verifyOtpMutation.isPending}
                >
                  {sendOtpMutation.isPending ? 'Sending…' : 'Send WhatsApp OTP'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="glass-surface border-white/15 bg-white/10 text-white">
            <CardHeader>
              <CardTitle>2. Enter the received code</CardTitle>
              <CardDescription className="text-white/70">
                Open WhatsApp and copy the 6-digit code from ICUPA. We&apos;ll verify it and sign you in.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="space-y-4" onSubmit={otpForm.handleSubmit((data) => verifyOtpMutation.mutate(data))}>
                <div className="space-y-2">
                  <Label htmlFor="otp">One-time passcode</Label>
                  <Input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="••••••"
                    className="bg-white/10 text-white placeholder:text-white/40"
                    {...otpForm.register('otp')}
                    aria-invalid={Boolean(otpForm.formState.errors.otp)}
                  />
                  {otpForm.formState.errors.otp && (
                    <p className="text-sm text-rose-300">{otpForm.formState.errors.otp.message}</p>
                  )}
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={!phoneE164 || verifyOtpMutation.isPending}
                >
                  {verifyOtpMutation.isPending ? 'Verifying…' : 'Verify & continue'}
                </Button>
              </form>
              {infoMessage && <p className="text-sm text-emerald-200">{infoMessage}</p>}
              {verifyOtpMutation.isError && (
                <p className="text-sm text-rose-300">
                  {verifyOtpMutation.error instanceof Error
                    ? verifyOtpMutation.error.message
                    : 'Something went wrong verifying the code.'}
                </p>
              )}
            </CardContent>
          </Card>

          {isAuthenticated && (
            <Card className="glass-surface border-emerald-400/40 bg-emerald-500/10 text-white">
              <CardHeader>
                <CardTitle>Success! You&apos;re signed in.</CardTitle>
                <CardDescription className="text-white/80">
                  Continue to your <Link className="underline" href="/">live dashboard</Link> or finish the{' '}
                  <Link className="underline" href="/settings">
                    onboarding checklist
                  </Link>
                  .
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
