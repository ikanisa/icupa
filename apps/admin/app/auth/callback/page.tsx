'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, AlertDescription } from '@icupa/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@icupa/ui/card';
import { Button } from '@icupa/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { getSupabaseBrowserClient } from '../../../lib/supabase-browser';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');
  const [message, setMessage] = useState<string>('Exchanging magic link for a secure session…');
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const code = searchParams.get('code');
    const redirectTo = searchParams.get('redirect_to') ?? '/';

    async function completeSignIn() {
      if (!code) {
        setStatus('error');
        setMessage('Magic link is missing a verification code. Request a new link and try again.');
        return;
      }

      setStatus('loading');
      setMessage('Finishing sign-in and restoring your admin workspace…');

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setStatus('error');
        setMessage(error.message ?? 'Unable to verify magic link.');
        return;
      }

      setStatus('success');
      setMessage('Authentication complete. Redirecting to the console…');
      setTimeout(() => {
        router.replace(redirectTo);
      }, 600);
    }

    completeSignIn();
  }, [router, searchParams, retryToken]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-16 text-white">
      <Card className="w-full max-w-md border border-white/10 bg-white/5">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-semibold">Signing you in</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-center">
            {status === 'loading' ? (
              <Loader2 className="h-8 w-8 animate-spin text-white/80" aria-hidden />
            ) : status === 'success' ? (
              <Loader2 className="h-8 w-8 animate-spin text-emerald-300" aria-hidden />
            ) : (
              <RefreshCw className="h-8 w-8 text-rose-300" aria-hidden />
            )}
          </div>
          <Alert className="border-white/10 bg-white/10 text-white">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
          {status === 'error' && (
            <Button
              type="button"
              variant="outline"
              className="w-full border-white/30 text-white"
              onClick={() => setRetryToken((token) => token + 1)}
            >
              Retry verification
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
