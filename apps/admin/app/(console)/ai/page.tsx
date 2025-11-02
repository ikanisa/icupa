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
  Input,
  Label,
  Slider,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  useToast,
} from '@icupa/ui';
import { fetchAgentSettings, updateAgentSetting } from '../../../lib/api';
import type { AgentSetting } from '../../../lib/types';
import { ShieldAlert, Sparkles } from 'lucide-react';

const autonomyCopy: Record<AgentSetting['autonomy'], string> = {
  0: 'Human-in-the-loop for every action',
  1: 'Requires approval for tool execution',
  2: 'Executes tools autonomously with guardrails',
  3: 'Full autonomy within configured budgets',
};

export default function AiSettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ['admin-ai-settings'], queryFn: fetchAgentSettings });
  const [drafts, setDrafts] = useState<Record<string, AgentSetting>>({});
  const [selectedAgent, setSelectedAgent] = useState<string | undefined>();

  useEffect(() => {
    if (!settings?.length) {
      return;
    }

    startTransition(() => {
      setDrafts(Object.fromEntries(settings.map((setting) => [setting.id, setting])));
      setSelectedAgent((prev) => prev ?? settings[0]?.id);
    });
  }, [settings]);

  const current = useMemo(() => (selectedAgent ? drafts[selectedAgent] : undefined), [drafts, selectedAgent]);

  const mutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AgentSetting> }) => updateAgentSetting(id, data),
    onSuccess: (_data, variables) => {
      toast({
        title: 'Agent settings queued',
        description: `Updates for ${variables.id} will propagate to the agents service within seconds.`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-ai-settings'] });
    },
    onError: () => {
      toast({
        title: 'Failed to sync with agents service',
        description: 'Review console logs and ensure the Edge Function is reachable.',
        variant: 'destructive',
      });
    },
  });

  const updateDraft = (id: string, update: Partial<AgentSetting>) => {
    setDrafts((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      return { ...prev, [id]: { ...existing, ...update } };
    });
  };

  const handleToolToggle = (toolName: string, enabled: boolean) => {
    if (!current) return;
    updateDraft(current.id, {
      tools: current.tools.map((tool) => (tool.name === toolName ? { ...tool, enabled } : tool)),
    });
  };

  const handleSave = () => {
    if (!current) return;
    mutation.mutate({
      id: current.id,
      data: {
        autonomy: current.autonomy,
        dailyBudgetUsd: current.dailyBudgetUsd,
        instructions: current.instructions,
        tools: current.tools,
      },
    });
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">AI autonomy</h1>
          <p className="max-w-2xl text-sm text-white/70">
            Tune structured instructions, guardrails, and tool access for every agent persona across the platform.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="glass-surface border-white/20 text-white"
          disabled={!current || mutation.isPending}
          onClick={handleSave}
        >
          {mutation.isPending ? 'Saving...' : 'Save configuration'}
        </Button>
      </header>

      <Tabs
        value={selectedAgent}
        onValueChange={(value) => setSelectedAgent(value)}
        className="flex flex-col gap-6"
        aria-label="Agent settings"
      >
        <TabsList className="glass-surface w-full justify-start gap-3 overflow-x-auto border border-white/10 bg-white/10 p-1">
          {settings?.map((agent) => (
            <TabsTrigger key={agent.id} value={agent.id} className="data-[state=active]:bg-white/20 data-[state=active]:text-white">
              {agent.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {settings?.map((agent) => {
          const draft = drafts[agent.id];
          return (
            <TabsContent key={agent.id} value={agent.id} className="space-y-6">
              {!draft ? (
                <Card className="glass-surface border-white/10 bg-white/5">
                  <CardContent className="py-10 text-center text-white/70">Loading configuration…</CardContent>
                </Card>
              ) : (
                <>
                  <Card className="glass-surface border-white/10 bg-white/5">
                    <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-white">{agent.title}</CardTitle>
                        <CardDescription className="text-white/70">{agent.description}</CardDescription>
                      </div>
                      <Badge variant="outline" className="border-white/20 text-xs text-white">
                        Last updated {new Date(draft.lastUpdated).toLocaleDateString()}
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-3">
                        <Label className="text-white">Autonomy level</Label>
                        <Slider
                          value={[draft.autonomy]}
                          min={0}
                          max={3}
                          step={1}
                          onValueChange={([value]) => updateDraft(agent.id, { autonomy: value as AgentSetting['autonomy'] })}
                        />
                        <p className="text-sm text-white/70">{autonomyCopy[draft.autonomy]}</p>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-white">Budget ceiling (USD/day)</Label>
                          <Input
                            inputMode="numeric"
                          value={draft.dailyBudgetUsd}
                          onChange={(event) =>
                              updateDraft(agent.id, {
                                dailyBudgetUsd: Number.parseInt(event.target.value || '0', 10),
                              })
                          }
                            className="border-white/20 bg-white/5 text-white placeholder:text-white/40"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white">Structured instructions</Label>
                          <Textarea
                            value={draft.instructions}
                            onChange={(event) => updateDraft(agent.id, { instructions: event.target.value })}
                            className="min-h-[120px] border-white/20 bg-white/5 text-white placeholder:text-white/40"
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-white">
                          <Sparkles className="h-4 w-4" aria-hidden />
                          <span className="text-sm font-medium">Tool allow-list</span>
                        </div>
                        <div className="space-y-2">
                          {draft.tools.map((tool) => (
                            <Card key={tool.name} className="glass-surface border-white/10 bg-white/5">
                              <CardContent className="flex flex-col gap-2 py-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                  <p className="text-sm font-medium text-white">{tool.name}</p>
                                  <p className="text-xs text-white/70">{tool.description}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {!tool.enabled && (
                                    <Badge variant="outline" className="border-amber-400/50 text-amber-200">
                                      Review before enabling
                                    </Badge>
                                  )}
                                  <Switch
                                    checked={tool.enabled}
                                    onCheckedChange={(checked) => handleToolToggle(tool.name, checked)}
                                    aria-label={`Toggle ${tool.name}`}
                                  />
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                        <div className="flex items-start gap-2 rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-white/70">
                          <ShieldAlert className="mt-0.5 h-4 w-4 text-rose-300" aria-hidden />
                          <p>
                            Autonomy changes sync to the agents-service via Supabase Edge Functions. Keep structured outputs tight
                            to avoid unintended actions.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
