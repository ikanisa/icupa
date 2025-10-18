import Link from 'next/link';
import { Button, Card, CardContent, CardFooter, CardHeader, CardTitle } from '@icupa/ui';
import { menuLocations } from '../../../data/menu';
import { centsToCurrency } from '../../../lib/format';

interface ReceiptPageProps {
  params: { id: string };
}

export default function ReceiptPage({ params }: ReceiptPageProps) {
  const location = menuLocations[0];
  const receiptId = params.id;

  return (
    <main className="flex-1 px-6 py-16">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 text-white">
        <header className="space-y-2 text-center">
          <h1 className="text-4xl font-semibold">Receipt #{receiptId.slice(0, 6).toUpperCase()}</h1>
          <p className="text-base text-white/70">Thanks for dining with ICUPA. A fiscal receipt is on its way to your inbox.</p>
        </header>

        <Card className="glass-surface border-white/10 bg-white/5 text-white">
          <CardHeader>
            <CardTitle className="text-xl">Kigali Harvest</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-white/70">
            <p>Table session: <span className="text-white/90">authed via QR</span></p>
            <p>Payment method: <span className="text-white/90">MoMo</span></p>
            <p>Total paid: <span className="text-gradient font-semibold">{centsToCurrency(28600, location.locale, location.currency)}</span></p>
            <p>Fiscal ID: <span className="text-white/90">RW-EBM-48219</span></p>
          </CardContent>
          <CardFooter className="flex flex-col gap-2 text-sm text-white/60">
            <p>We log this receipt in Supabase with full RLS. Admins can revoke or re-issue from the new operations portal.</p>
            <p>Need assistance? Reply to the emailed receipt and our support team will help.</p>
          </CardFooter>
        </Card>

        <div className="flex justify-center gap-3">
          <Button asChild variant="outline" className="glass-surface border-white/20 text-white hover:bg-white/10">
            <Link href="/">Back to menu</Link>
          </Button>
          <Button asChild className="glass-surface bg-white/15 text-white hover:bg-white/20">
            <Link href="/ai">Ask AI for next visit</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
