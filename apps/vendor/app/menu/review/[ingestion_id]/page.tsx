'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ScrollArea,
} from '@icupa/ui';
import { fetchIngestionDraft } from '../../../../lib/api';

export default function ReviewDraftPage() {
  const params = useParams<{ ingestion_id: string }>();
  const ingestionId = params?.ingestion_id ?? 'ing-481';
  const { data } = useQuery({ queryKey: ['vendor-ingestion', ingestionId], queryFn: () => fetchIngestionDraft(ingestionId) });

  const allItems = useMemo(() => data?.categories.flatMap((category) => category.items) ?? [], [data]);

  return (
    <main className="flex-1 bg-gradient-to-br from-slate-950 via-slate-900/80 to-fuchsia-900/60 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge variant="outline" className="glass-surface border-white/20 bg-white/10 text-white">
              Draft review
            </Badge>
            <h1 className="mt-4 text-4xl font-semibold md:text-5xl">Structured menu review</h1>
            <p className="mt-2 max-w-3xl text-lg text-white/80">
              Inspect OCR results, tweak allergens, and approve pricing. Publishing pushes updates to diners and retrains
              ICUPA menu intelligence.
            </p>
          </div>
          <Button asChild variant="outline" className="glass-surface border-white/20">
            <Link href="/menu">Back to ingestions</Link>
          </Button>
        </div>

        {data && (
          <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <Card className="glass-surface border-white/10 bg-white/5 text-white">
              <CardHeader>
                <CardTitle>Categories</CardTitle>
                <CardDescription className="text-white/70">
                  {data.categories.length} categories • {allItems.length} items • Confidence {Math.round(data.summary.confidence * 100)}%
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[520px] space-y-6 pr-4">
                  {data.categories.map((category) => (
                    <div key={category.id} className="space-y-3 rounded-2xl border border-white/15 bg-white/5 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-lg font-semibold text-white">{category.name}</p>
                        <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
                          {category.items.length} items
                        </Badge>
                      </div>
                      <div className="space-y-4">
                        {category.items.map((item) => (
                          <div key={item.id} className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-base font-semibold text-white">{item.name}</p>
                                <p className="text-sm text-white/70">{item.description}</p>
                              </div>
                              <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
                                ${item.price.toFixed(2)}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {item.allergens.map((allergen) => (
                                <Badge key={allergen} variant="outline" className="border-rose-400/40 bg-rose-500/10 text-rose-100">
                                  {allergen}
                                </Badge>
                              ))}
                            </div>
                            <div className="space-y-1 text-sm text-white/70">
                              <p className="font-semibold text-white/80">Modifiers</p>
                              <ul className="list-disc space-y-1 pl-4">
                                {item.modifiers.map((modifier) => (
                                  <li key={modifier}>{modifier}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="glass-surface border-white/10 bg-white/5 text-white">
              <CardHeader>
                <CardTitle>Publish checklist</CardTitle>
                <CardDescription className="text-white/70">
                  Confidence {Math.round(data.summary.confidence * 100)}% • {data.summary.highRiskItems} allergen flags
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 rounded-2xl border border-white/15 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">High-risk items</p>
                  <p className="text-sm text-white/80">
                    Review allergen accuracy on dishes with peanuts, eggs, soy, and shellfish before publishing.
                  </p>
                </div>
                <div className="space-y-2 rounded-2xl border border-white/15 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">Pricing audit</p>
                  <p className="text-sm text-white/80">
                    Confirm converted pricing matches MoMo receipts and fiscal integration requirements for your region.
                  </p>
                </div>
                <Button className="w-full bg-emerald-500 text-emerald-950 hover:bg-emerald-400">Publish menu</Button>
                <Button variant="outline" className="w-full border-white/20 text-white">
                  Download diff for records
                </Button>
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </main>
  );
}
