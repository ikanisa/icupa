"use client";

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Input, Label, LiquidGlassCard, useToast } from '@icupa/ui';
import { requestAdminMagicLink } from '../../lib/api';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: (payload: { email: string }) => requestAdminMagicLink(payload.email),
    onSuccess: () => {
      toast({
        title: 'Magic link sent',
        description: 'Check your inbox for a secure sign-in link. Links expire after ten minutes.',
      });
    },
    onError: () => {
      toast({
        title: 'Unable to send magic link',
        description: 'Verify SMTP credentials and Supabase Edge Function availability.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email) {
      toast({ title: 'Email required', description: 'Enter a valid admin email before requesting a link.', variant: 'destructive' });
      return;
    }
    mutation.mutate({ email });
  };

  return (
    <main className="flex min-h-[80vh] items-center justify-center px-6 py-16">
      <LiquidGlassCard className="w-full max-w-lg space-y-8 p-10">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold text-white">Admin magic link</h1>
          <p className="text-white/70">
            Enter an approved email address to receive a one-time sign-in link. The production flow connects to the
            `auth/admin_email_magiclink` Supabase Edge Function.
          </p>
        </div>
        <form className="space-y-6" aria-label="Admin magic link form" onSubmit={handleSubmit}>
          <div className="space-y-2 text-left">
            <Label htmlFor="admin-email">Work email</Label>
            <Input
              id="admin-email"
              name="admin-email"
              type="email"
              placeholder="you@icupa.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="border-white/20 bg-white/5 text-white placeholder:text-white/40"
            />
          </div>
          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? 'Sending…' : 'Send magic link'}
          </Button>
        </form>
        <p className="text-center text-sm text-white/60">
          Rollout docs live under <Link href="/flags" className="underline">Flags &amp; Kill-switches</Link> once enabled.
        </p>
      </LiquidGlassCard>
    </main>
  );
}
