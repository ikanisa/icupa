import Link from 'next/link';
import { APP_DEFINITIONS } from '@icupa/types/apps';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, LiquidGlassCard } from '@icupa/ui';
import { ConsoleShell } from './(console)/shell';
import { Overview } from '../components/overview';

const adminApp = APP_DEFINITIONS.admin;

export default function AdminLanding() {
  return (
    <ConsoleShell>
      <div className="space-y-10">
        <LiquidGlassCard className="flex flex-col gap-8 p-10">
          <div>
            <Badge variant="outline" className="glass-surface border-white/20 bg-white/10 text-white">
              {adminApp.tagline}
            </Badge>
            <h1 className="mt-6 text-4xl font-semibold md:text-6xl">{adminApp.title}</h1>
            <p className="mt-6 max-w-3xl text-lg text-white/80 md:text-xl">{adminApp.description}</p>
          </div>

          <div className="flex flex-wrap gap-4">
            <Button size="lg" asChild>
              <Link href="/login">Request magic link</Link>
            </Button>
            <Button size="lg" variant="outline" className="glass-surface border-white/20" asChild>
              <Link href="/flags">Review rollout flags</Link>
            </Button>
          </div>
        </LiquidGlassCard>

        <div className="grid gap-6 md:grid-cols-3">
          {adminApp.features.map((feature) => (
            <Card key={feature.title} className="glass-surface border-white/10 bg-white/5">
              <CardHeader>
                <CardTitle className="text-xl font-semibold text-white">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-white/75">{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        <Overview />
      </div>
    </ConsoleShell>
  );
}
