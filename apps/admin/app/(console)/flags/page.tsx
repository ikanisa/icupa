'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
  useToast,
} from '@icupa/ui';
import { coreFeatureFlags, createFeatureFlag } from '@icupa/config/feature-flags';
import type { AppRole } from '@icupa/types/apps';
import { fetchFeatureFlags, syncFeatureFlag } from '../../../lib/api';
import type { FeatureFlagState } from '../../../data/sample';
import { Globe2, RefreshCw, ShieldOff } from 'lucide-react';

export default function FlagsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: flags } = useQuery({ queryKey: ['admin-feature-flags'], queryFn: fetchFeatureFlags });
  const [state, setState] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (flags) {
      setState(Object.fromEntries(flags.map((flag) => [flag.key, flag.enabled])));
    }
  }, [flags]);

  const mutation = useMutation({
    mutationFn: ({ flag, enabled }: { flag: FeatureFlagState; enabled: boolean }) =>
      syncFeatureFlag(resolveFlagDefinition(flag), enabled),
    onSuccess: (_, variables) => {
      toast({
        title: 'Flag synced',
        description: `${variables.flag.label} is now ${variables.enabled ? 'enabled' : 'disabled'}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] });
    },
    onError: () => {
      toast({
        title: 'Failed to update flag',
        description: 'Check Edge Function logs and retry.',
        variant: 'destructive',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] });
    },
  });

  const toggleFlag = (flag: FeatureFlagState, enabled: boolean) => {
    setState((prev) => ({ ...prev, [flag.key]: enabled }));
    mutation.mutate({ flag, enabled });
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">Feature flags & kill-switches</h1>
          <p className="max-w-2xl text-sm text-white/70">
            Control rollout canaries, AI access, and legacy fallbacks across every app without redeploying.
          </p>
        </div>
        <Button size="sm" variant="outline" className="glass-surface border-white/20 text-white">
          Download rollout plan
        </Button>
      </header>

      <Card className="glass-surface border-white/10 bg-white/5">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-white">
            <Globe2 className="h-4 w-4" aria-hidden />
            <CardTitle className="text-white">Rollout guardrails</CardTitle>
          </div>
          <Badge variant="outline" className="border-emerald-400/50 text-emerald-200">
            Canary safe
          </Badge>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-white/70">
          <p>
            Each toggle writes to Supabase via the `admin/feature_flags/upsert` Edge Function and propagates to all PWAs within
            seconds. Use kill-switches to fall back to the legacy app instantly.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge className="border-white/20 bg-white/10 text-white">
              <RefreshCw className="mr-1 h-3 w-3" aria-hidden />
              Syncs via realtime
            </Badge>
            <Badge className="border-rose-400/50 bg-rose-500/10 text-rose-100">
              <ShieldOff className="mr-1 h-3 w-3" aria-hidden />
              Monitor before enabling
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {flags?.map((flag) => (
          <Card key={flag.key} className="glass-surface border-white/10 bg-white/5">
            <CardHeader className="flex flex-col gap-1">
              <CardTitle className="text-white">{flag.label}</CardTitle>
              <CardDescription className="text-white/70">{flag.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  {flag.audience.map((role) => (
                    <Badge key={role} variant="outline" className="border-white/20 text-xs text-white">
                      {role}
                    </Badge>
                  ))}
                </div>
                <Switch
                  checked={state[flag.key] ?? false}
                  onCheckedChange={(checked) => toggleFlag(flag, checked)}
                  aria-label={`Toggle ${flag.label}`}
                  disabled={mutation.isPending}
                />
              </div>
              <p className="text-xs text-white/60">
                Default: {resolveFlagDefinition(flag).enabledByDefault ? 'enabled' : 'disabled'} · Key: {flag.key}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function resolveFlagDefinition(flag: FeatureFlagState) {
  const coreMatch = Object.values(coreFeatureFlags).find((core) => core.key === flag.key);
  if (coreMatch) {
    return coreMatch;
  }
  return createFeatureFlag({
    key: flag.key,
    description: flag.description,
    enabledByDefault: flag.enabled,
    audience: flag.audience as AppRole[],
  });
}
