'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  Textarea,
} from '@icupa/ui';
import { fetchPromos } from '../../lib/api';

export default function PromosPage() {
  const { data } = useQuery({ queryKey: ['vendor-promos'], queryFn: fetchPromos });
  const [promoName, setPromoName] = useState('Happy hour spritz flight');
  const [budget, setBudget] = useState('250');
  const [notes, setNotes] = useState('Offer only to tables flagged for celebratory context. ε-bandit epsilon at 0.2.');

  return (
    <main className="flex-1 bg-gradient-to-br from-slate-950 via-slate-900/80 to-orange-900/60 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge variant="outline" className="glass-surface border-white/20 bg-white/10 text-white">
              Promotions
            </Badge>
            <h1 className="mt-4 text-4xl font-semibold md:text-5xl">Tune AI-led promos</h1>
            <p className="mt-2 max-w-3xl text-lg text-white/80">
              Configure ε-bandit controls, budgets, and eligibility signals. Changes deploy instantly to ICUPA agents.
            </p>
          </div>
          <Button variant="outline" className="glass-surface border-white/20">
            View analytics
          </Button>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Card className="glass-surface border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle>Create promo</CardTitle>
              <CardDescription className="text-white/70">
                Define the offer, guardrails, and rollout notes. ICUPA applies epsilon-greedy exploration by default.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="promoName">Promo name</Label>
                <Input
                  id="promoName"
                  value={promoName}
                  onChange={(event) => setPromoName(event.target.value)}
                  className="bg-white/10 text-white placeholder:text-white/40"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budget">Budget (USD)</Label>
                <Input
                  id="budget"
                  type="number"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  className="bg-white/10 text-white placeholder:text-white/40"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Rollout notes</Label>
                <Textarea
                  id="notes"
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="bg-white/10 text-white placeholder:text-white/40"
                />
                <p className="text-sm text-white/70">
                  Mention eligible categories, allergy exclusions, or hours. Agents apply this context before upselling.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400">Launch promo</Button>
                <Button variant="outline" className="glass-surface border-white/20 text-white">
                  Save as draft
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-surface border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle>Active programs</CardTitle>
              <CardDescription className="text-white/70">
                Track adoption and budget burn across live promos. Pause instantly if compliance flags issues.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data?.map((promo) => (
                <div key={promo.id} className="space-y-2 rounded-2xl border border-white/15 bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{promo.name}</p>
                      <p className="text-xs uppercase tracking-[0.25em] text-white/60">
                        Started {new Date(promo.startedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
                      {promo.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-white/70">Budget remaining ${promo.budgetRemaining.toFixed(0)}</p>
                  <p className="text-sm text-white/70">Acceptance rate {(promo.acceptanceRate * 100).toFixed(0)}%</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="border-white/20 text-white">
                      Adjust epsilon
                    </Button>
                    <Button size="sm" className="bg-rose-500 text-rose-950 hover:bg-rose-400">
                      Pause promo
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
