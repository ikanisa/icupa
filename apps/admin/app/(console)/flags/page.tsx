'use client';

import { startTransition, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Switch,
  Textarea,
  useToast,
} from '@icupa/ui';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@icupa/ui/form';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@icupa/ui/dialog';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Globe2, RefreshCw, ShieldOff, Wand2, Trash2, Plus, AlertTriangle } from 'lucide-react';
import {
  createFeatureFlag,
  deleteFeatureFlag,
  fetchFeatureFlags,
  updateFeatureFlag,
} from '../../../lib/api';
import type { FeatureFlagPayload, FeatureFlagState } from '../../../lib/types';

const AUDIENCE_OPTIONS = ['client', 'vendor', 'admin', 'ops', 'support'] as const;

const flagSchema = z.object({
  id: z.string().optional(),
  key: z.string().min(2, 'Provide a unique key'),
  label: z.string().min(2, 'Label is required'),
  description: z.string().min(4, 'Add a brief description'),
  enabled: z.boolean().default(true),
  audience: z.array(z.enum(AUDIENCE_OPTIONS)).min(1, 'Select at least one audience'),
  tenantId: z.string().optional().nullable(),
  experimentFlag: z.string().optional().nullable(),
  autonomyLevel: z.coerce.number().min(0).max(3),
  sessionBudgetUsd: z.coerce.number().min(0),
  dailyBudgetUsd: z.coerce.number().min(0),
  instructions: z.string().min(4, 'Provide operational guidance'),
});

type FlagFormValues = z.infer<typeof flagSchema>;

const defaultFlagValues: FlagFormValues = {
  key: '',
  label: '',
  description: '',
  enabled: true,
  audience: ['client'],
  tenantId: null,
  experimentFlag: '',
  autonomyLevel: 1,
  sessionBudgetUsd: 0.75,
  dailyBudgetUsd: 50,
  instructions: 'Follow tenant guardrails and cite receipts in responses.',
};

export default function FlagsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: flags } = useQuery({ queryKey: ['admin-feature-flags'], queryFn: fetchFeatureFlags });
  const [toggleState, setToggleState] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlagState | null>(null);

  useEffect(() => {
    if (!flags) {
      return;
    }

    startTransition(() => {
      setToggleState(Object.fromEntries(flags.map((flag) => [flag.id, flag.enabled])));
    });
  }, [flags]);

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => updateFeatureFlag(id, { enabled }),
    onSuccess: (_, variables) => {
      toast({
        title: 'Flag updated',
        description: `Kill switch ${variables.enabled ? 'enabled' : 'disabled'} successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] });
    },
    onError: (_error, variables) => {
      setToggleState((prev) => ({ ...prev, [variables.id]: !variables.enabled }));
      toast({
        title: 'Unable to update flag',
        description: 'Review Supabase audit logs or retry.',
        variant: 'destructive',
      });
    },
  });

  const handleToggle = (flag: FeatureFlagState, enabled: boolean) => {
    setToggleState((prev) => ({ ...prev, [flag.id]: enabled }));
    toggleMutation.mutate({ id: flag.id, enabled });
  };

  const openForCreate = () => {
    setEditingFlag(null);
    setDialogOpen(true);
  };

  const openForEdit = (flag: FeatureFlagState) => {
    setEditingFlag(flag);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingFlag(null);
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
        <Button size="sm" className="glass-surface bg-white text-black" onClick={openForCreate}>
          <Plus className="mr-2 h-4 w-4" aria-hidden /> New feature flag
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
            Updates land in <code>agent_runtime_configs</code> with audit logging and realtime propagation. Disable any flag to
            trigger the kill switch and halt agent access instantly.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge className="border-white/20 bg-white/10 text-white">
              <RefreshCw className="mr-1 h-3 w-3" aria-hidden /> Syncs via realtime
            </Badge>
            <Badge className="border-rose-400/50 bg-rose-500/10 text-rose-100">
              <ShieldOff className="mr-1 h-3 w-3" aria-hidden /> Monitor before enabling
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {flags?.map((flag) => (
          <Card key={flag.id} className="glass-surface border-white/10 bg-white/5">
            <CardHeader className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">{flag.label}</CardTitle>
                <Button size="sm" variant="outline" className="border-white/30 text-white" onClick={() => openForEdit(flag)}>
                  Edit
                </Button>
              </div>
              <CardDescription className="text-white/70">{flag.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm text-white/70">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  {flag.audience.map((role) => (
                    <Badge key={role} variant="outline" className="border-white/20 text-xs text-white">
                      {role}
                    </Badge>
                  ))}
                  {flag.experimentFlag && (
                    <Badge variant="outline" className="border-amber-300/40 text-xs text-amber-200">
                      {flag.experimentFlag}
                    </Badge>
                  )}
                  {flag.syncPending && (
                    <Badge variant="outline" className="border-sky-300/40 text-xs text-sky-200">
                      Sync pending
                    </Badge>
                  )}
                </div>
                <Switch
                  checked={toggleState[flag.id] ?? flag.enabled}
                  onCheckedChange={(checked) => handleToggle(flag, checked)}
                  aria-label={`Toggle ${flag.label}`}
                  disabled={toggleMutation.isPending}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-white/50">Autonomy</p>
                  <p className="text-white font-medium">L{flag.autonomyLevel}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-white/50">Daily budget</p>
                  <p className="text-white font-medium">${flag.dailyBudgetUsd.toFixed(2)}</p>
                </div>
              </div>
              <p className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                {flag.instructions}
              </p>
              <p className="text-xs text-white/50">Key: {flag.key}</p>
            </CardContent>
          </Card>
        ))}
        {!flags?.length && (
          <Card className="glass-surface border-dashed border-white/20 bg-white/5">
            <CardContent className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center text-white/60">
              <Wand2 className="h-8 w-8" aria-hidden />
              <p>No feature flags yet. Create one to manage kill switches for agents and surfaces.</p>
              <Button variant="outline" className="border-white/30 text-white" onClick={openForCreate}>
                <Plus className="mr-2 h-4 w-4" aria-hidden /> Create feature flag
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <FlagDialog
        open={dialogOpen}
        onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}
        flag={editingFlag}
        onSaved={() => {
          closeDialog();
          queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] });
        }}
      />
    </div>
  );
}

function toFormValues(flag: FeatureFlagState | null): FlagFormValues {
  if (!flag) {
    return defaultFlagValues;
  }
  return {
    id: flag.id,
    key: flag.key,
    label: flag.label,
    description: flag.description,
    enabled: flag.enabled,
    audience: (flag.audience as FlagFormValues['audience']) ?? ['client'],
    tenantId: flag.tenantId,
    experimentFlag: flag.experimentFlag ?? '',
    autonomyLevel: flag.autonomyLevel,
    sessionBudgetUsd: flag.sessionBudgetUsd,
    dailyBudgetUsd: flag.dailyBudgetUsd,
    instructions: flag.instructions,
  };
}

function toPayload(values: FlagFormValues): FeatureFlagPayload {
  const level = Math.min(3, Math.max(0, Math.round(values.autonomyLevel))) as 0 | 1 | 2 | 3;
  return {
    key: values.key,
    label: values.label,
    description: values.description,
    enabled: values.enabled,
    audience: values.audience,
    tenantId: values.tenantId ?? null,
    experimentFlag: values.experimentFlag ? values.experimentFlag : null,
    autonomyLevel: level,
    sessionBudgetUsd: values.sessionBudgetUsd,
    dailyBudgetUsd: values.dailyBudgetUsd,
    instructions: values.instructions,
  };
}

function FlagDialog({
  open,
  onOpenChange,
  flag,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flag: FeatureFlagState | null;
  onSaved: () => void;
}) {
  const isEditing = Boolean(flag);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const form = useForm<FlagFormValues>({
    resolver: zodResolver(flagSchema),
    defaultValues: toFormValues(flag),
  });

  useEffect(() => {
    form.reset(toFormValues(flag));
  }, [flag, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: FlagFormValues) => {
      const payload = toPayload(values);
      if (values.id) {
        return updateFeatureFlag(values.id, payload);
      }
      return createFeatureFlag(payload);
    },
    onSuccess: () => {
      toast({ title: 'Feature flag saved', description: 'Changes propagated to the agents service.' });
      onSaved();
      form.reset(defaultFlagValues);
    },
    onError: (error: Error) => {
      toast({ title: 'Unable to save flag', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFeatureFlag(id),
    onSuccess: () => {
      toast({ title: 'Feature flag removed', description: 'Kill switch configuration has been cleared.' });
      queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] });
      onSaved();
    },
    onError: (error: Error) => {
      toast({ title: 'Unable to delete flag', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (values: FlagFormValues) => {
    saveMutation.mutate(values);
  };

  const handleDelete = () => {
    if (flag?.id) {
      deleteMutation.mutate(flag.id);
    }
  };

  const selectedAudience = useWatch({ control: form.control, name: 'audience' });

  const autonomyMarks = useMemo(
    () => [
      { value: 0, label: 'L0' },
      { value: 1, label: 'L1' },
      { value: 2, label: 'L2' },
      { value: 3, label: 'L3' },
    ],
    [],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-slate-950 text-white">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit feature flag' : 'Create feature flag'}</DialogTitle>
          <DialogDescription className="text-white/70">
            Configure guardrails, budgets, and audiences. All changes are logged in <code>agent_config_audit_events</code>.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="flex flex-col gap-5" onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="key"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Key</FormLabel>
                    <FormControl>
                      <Input placeholder="ai-waiter-beta" {...field} disabled={isEditing} />
                    </FormControl>
                    <FormDescription>Used as the runtime identifier in Supabase.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label</FormLabel>
                    <FormControl>
                      <Input placeholder="AI Waiter beta" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={3} className="resize-none" placeholder="Explain what enabling this flag does" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="dailyBudgetUsd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Daily budget (USD)</FormLabel>
                    <FormControl>
                      <Input type="number" step="1" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sessionBudgetUsd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Session budget (USD)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.05" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="autonomyLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Autonomy level</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      {autonomyMarks.map((mark) => (
                        <Button
                          key={mark.value}
                          type="button"
                          size="sm"
                          variant={field.value === mark.value ? 'default' : 'outline'}
                          className={field.value === mark.value ? 'bg-white text-black' : 'border-white/30 text-white'}
                          onClick={() => field.onChange(mark.value)}
                        >
                          {mark.label}
                        </Button>
                      ))}
                    </div>
                  </FormControl>
                  <FormDescription>Select the guardrail tier for agent autonomy.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="audience"
              render={() => (
                <FormItem>
                  <FormLabel>Audience</FormLabel>
                  <div className="grid gap-2 md:grid-cols-2">
                    {AUDIENCE_OPTIONS.map((option) => (
                      <FormField
                        key={option}
                        control={form.control}
                        name="audience"
                        render={({ field }) => {
                          const checked = field.value.includes(option);
                          return (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border border-white/15 bg-white/5 p-3">
                              <FormLabel className="text-sm text-white/80">{option}</FormLabel>
                              <FormControl>
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(value) => {
                                    const next = value
                                      ? [...field.value, option]
                                      : field.value.filter((item) => item !== option);
                                    field.onChange(next);
                                  }}
                                />
                              </FormControl>
                            </FormItem>
                          );
                        }}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Operator instructions</FormLabel>
                  <FormControl>
                    <Textarea rows={4} className="resize-none" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="experimentFlag"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Experiment tag</FormLabel>
                    <FormControl>
                      <Input placeholder="dessert-pilot" {...field} />
                    </FormControl>
                    <FormDescription>Optional tag for experiment grouping.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="enabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-white/15 bg-white/5 p-4">
                    <div>
                      <FormLabel>Enabled by default</FormLabel>
                      <FormDescription>Determines the kill-switch default state.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="mt-4">
              {isEditing && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending || saveMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden /> Delete flag
                </Button>
              )}
              <div className="flex-1" />
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saveMutation.isPending || deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : isEditing ? 'Save changes' : 'Create flag'}
              </Button>
            </DialogFooter>
            {selectedAudience.includes('admin') && (
              <p className="flex items-center gap-2 text-xs text-amber-200">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                Admin audience toggles unlock privileged agent tooling. Ensure audit coverage is configured.
              </p>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
