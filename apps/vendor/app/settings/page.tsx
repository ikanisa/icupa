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
import { fetchOnboardingChecklist } from '../../lib/api';
import { useVendorAuth } from '../../lib/auth-context';

const deeplinkBase = 'https://maps.app.goo.gl/?link=';

export default function SettingsOnboardingPage() {
  const { user } = useVendorAuth();
  const { data } = useQuery({ queryKey: ['vendor-onboarding'], queryFn: fetchOnboardingChecklist });
  const [businessName, setBusinessName] = useState('Sunset Bistro');
  const [whatsappNumber, setWhatsappNumber] = useState(user?.phone ?? '+250788123456');
  const [momoCode, setMomoCode] = useState('SUNSET01');
  const [gpsNotes, setGpsNotes] = useState('Pinned next to Umusambi Village entrance.');
  const [deeplink, setDeeplink] = useState(`${deeplinkBase}icupa-sunset-bistro`);
  const [menuNotes, setMenuNotes] = useState('Seasonal update with vegan mains and kids section.');

  return (
    <main className="flex-1 bg-gradient-to-br from-slate-950 via-slate-900/80 to-teal-900/60 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-16">
        <div className="space-y-4">
          <Badge variant="outline" className="glass-surface border-white/20 bg-white/10 text-white">
            Vendor onboarding
          </Badge>
          <h1 className="text-4xl font-semibold md:text-5xl">Complete your rollout</h1>
          <p className="max-w-3xl text-lg text-white/80">
            Work through each requirement to activate table ordering, AI upsells, and settlement. ICUPA saves progress
            automatically and alerts your partner success manager when you finish.
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card className="glass-surface border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle>Profile & payouts</CardTitle>
              <CardDescription className="text-white/70">
                Confirm business info, MoMo collection codes, and GPS pin for courier routing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="businessName">Legal business name</Label>
                  <Input
                    id="businessName"
                    value={businessName}
                    onChange={(event) => setBusinessName(event.target.value)}
                    className="bg-white/10 text-white placeholder:text-white/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">Primary WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    value={whatsappNumber}
                    onChange={(event) => setWhatsappNumber(event.target.value)}
                    className="bg-white/10 text-white placeholder:text-white/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="momo">MoMo collection code</Label>
                  <Input
                    id="momo"
                    value={momoCode}
                    onChange={(event) => setMomoCode(event.target.value)}
                    className="bg-white/10 text-white placeholder:text-white/40"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deeplink">Google Maps deeplink</Label>
                  <Input
                    id="deeplink"
                    value={deeplink}
                    onChange={(event) => setDeeplink(event.target.value)}
                    className="bg-white/10 text-white placeholder:text-white/40"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gps-notes">GPS notes</Label>
                <Textarea
                  id="gps-notes"
                  value={gpsNotes}
                  onChange={(event) => setGpsNotes(event.target.value)}
                  rows={3}
                  className="bg-white/10 text-white placeholder:text-white/40"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="menu-notes">Menu update notes</Label>
                <Textarea
                  id="menu-notes"
                  value={menuNotes}
                  onChange={(event) => setMenuNotes(event.target.value)}
                  rows={3}
                  className="bg-white/10 text-white placeholder:text-white/40"
                />
                <p className="text-sm text-white/70">
                  Outline big changes or allergen considerations. ICUPA shares these with the OCR review team.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400">Save profile</Button>
                <Button variant="outline" className="glass-surface border-white/20 text-white">
                  Trigger success manager review
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-surface border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle>Checklist</CardTitle>
              <CardDescription className="text-white/70">
                ICUPA auto-updates statuses as you verify your number, upload menus, and confirm payouts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data?.map((item) => (
                <div
                  key={item.id}
                  className={`space-y-2 rounded-2xl border p-4 ${
                    item.status === 'complete'
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100'
                      : item.status === 'in-progress'
                        ? 'border-amber-400/40 bg-amber-400/15 text-amber-100'
                        : 'border-white/15 bg-white/5 text-white'
                  }`}
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/60">{item.name}</p>
                  <p className="text-sm text-white/80">{item.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <Card className="glass-surface border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle>Activation timeline</CardTitle>
            <CardDescription className="text-white/70">
              Once all checklist items are complete, ICUPA pushes your tenant live and issues the first agent audit.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <TimelineItem title="WhatsApp verification" description="OTP confirmed and staff invites sent." step={1} />
            <TimelineItem
              title="Menu OCR"
              description="Upload at least one PDF/JPEG. Agents review allergens and pricing."
              step={2}
            />
            <TimelineItem
              title="Go live"
              description="Switch feature flag on for 10% of diners, then graduate once KPIs stabilize."
              step={3}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function TimelineItem({ title, description, step }: { title: string; description: string; step: number }) {
  return (
    <div className="space-y-2 rounded-2xl border border-white/15 bg-white/5 p-4">
      <p className="text-sm uppercase tracking-[0.25em] text-white/60">Step {step}</p>
      <p className="text-lg font-semibold text-white">{title}</p>
      <p className="text-sm text-white/80">{description}</p>
    </div>
  );
}
