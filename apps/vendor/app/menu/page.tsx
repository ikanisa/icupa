'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
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
  Textarea,
} from '@icupa/ui';
import { fetchMenuIngestions, startMenuIngestion } from '../../lib/api';

export default function MenuManagerPage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['vendor-menu-ingestions'], queryFn: fetchMenuIngestions });
  const [fileName, setFileName] = useState('');
  const [notes, setNotes] = useState('Include pricing in RWF and highlight seasonal specials.');

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!fileName) {
        throw new Error('Select a file to upload.');
      }
      const response = await startMenuIngestion({ fileName, notes });
      return response;
    },
    onSuccess: async () => {
      setFileName('');
      await queryClient.invalidateQueries({ queryKey: ['vendor-menu-ingestions'] });
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    uploadMutation.mutate();
  };

  return (
    <main className="flex-1 bg-gradient-to-br from-slate-950 via-slate-900/80 to-cyan-900/60 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Badge variant="outline" className="glass-surface border-white/20 bg-white/10 text-white">
              Menu ingestion
            </Badge>
            <h1 className="mt-4 text-4xl font-semibold md:text-5xl">Upload & publish menu</h1>
            <p className="mt-2 max-w-2xl text-lg text-white/80">
              Launch OCR in minutes. Upload PDFs or photos, review structured results, and publish to diners once ready.
            </p>
          </div>
          <Button variant="outline" className="glass-surface border-white/20" asChild>
            <Link href="/menu/review/ing-481">Open last draft</Link>
          </Button>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <Card className="glass-surface border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle>Upload new menu</CardTitle>
              <CardDescription className="text-white/70">
                Supported formats: PDF, JPG, PNG. ICUPA redacts prices in traces and surfaces allergen warnings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="file">Menu file</Label>
                  <Input
                    id="file"
                    type="file"
                    className="bg-white/10 text-white"
                    onChange={(event) => setFileName(event.target.files?.[0]?.name ?? '')}
                  />
                  <p className="text-sm text-white/60">Selected: {fileName || 'None'}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes for OCR team</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={4}
                    className="bg-white/10 text-white placeholder:text-white/40"
                  />
                </div>
                <Button type="submit" disabled={uploadMutation.isPending}>
                  {uploadMutation.isPending ? 'Uploading…' : 'Kick off ingestion'}
                </Button>
                {uploadMutation.isError && (
                  <p className="text-sm text-rose-300">
                    {uploadMutation.error instanceof Error
                      ? uploadMutation.error.message
                      : 'Unable to start ingestion. Try again.'}
                  </p>
                )}
              </form>
            </CardContent>
          </Card>

          <Card className="glass-surface border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle>Recent ingestions</CardTitle>
              <CardDescription className="text-white/70">
                Track progress from upload to publish. Review drafts to approve items and modifiers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {data?.map((ingestion) => (
                <div
                  key={ingestion.id}
                  className="space-y-2 rounded-2xl border border-white/15 bg-white/5 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">{ingestion.fileName}</p>
                      <p className="text-xs uppercase tracking-[0.25em] text-white/60">
                        Started {new Date(ingestion.startedAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-white/30 bg-white/10 text-white">
                      {ingestion.status === 'ready' ? 'Ready for review' : `${ingestion.completion}%`}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" asChild variant="outline" className="border-white/20 text-white">
                      <Link href={`/menu/review/${ingestion.id}`}>Open draft</Link>
                    </Button>
                    <Button size="sm" className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400">
                      Publish to diners
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
