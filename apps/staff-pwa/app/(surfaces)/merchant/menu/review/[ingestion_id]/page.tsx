"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@icupa/ui/alert";
import { Badge } from "@icupa/ui/badge";
import { Button } from "@icupa/ui/button";
import { Card } from "@icupa/ui/card";
import { Input } from "@icupa/ui/input";
import { Skeleton } from "@icupa/ui/skeleton";
import { Switch } from "@icupa/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@icupa/ui/table";
import { Textarea } from "@icupa/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@icupa/ui/select";
import { Slider } from "@icupa/ui/slider";
import { Separator } from "@icupa/ui/separator";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { useMenuIngestionDetail, usePublishIngestion, useSignedPreviewUrl, useUpdateStagingItem, useProcessIngestion } from "@/hooks/useMenuIngestionPipeline";
import { supabase } from "@/lib/supabase-client";
import { useQuery } from "@tanstack/react-query";
import { useMerchantProfile } from "@/hooks/useMerchantProfile";

interface MenuRecord {
  id: string;
  name: string;
  version: number;
}

function useLocationMenus(locationId?: string | null) {
  return useQuery({
    queryKey: ["merchant", "menus", locationId],
    queryFn: async () => {
      if (!locationId) return [] as MenuRecord[];
      const { data, error } = await supabase
        .from("menus")
        .select("id, name, version")
        .eq("location_id", locationId)
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MenuRecord[];
    },
    enabled: Boolean(locationId),
  });
}

export default function MerchantMenuReviewPage() {
  const params = useParams<{ ingestion_id: string }>();
  const ingestionId = params?.ingestion_id;
  const router = useRouter();

  const { data: detail, isLoading, error, refetch } = useMenuIngestionDetail(ingestionId);
  const updateItem = useUpdateStagingItem();
  const publish = usePublishIngestion();
  const reprocess = useProcessIngestion();
  const signPreview = useSignedPreviewUrl();
  const { data: menus = [] } = useLocationMenus(detail?.locationId ?? null);
  const { data: profile } = useMerchantProfile();
  const [selectedMenu, setSelectedMenu] = useState<string | undefined>();
  const [confidenceFloor, setConfidenceFloor] = useState<number>(0.55);
  const [pagePreviews, setPagePreviews] = useState<{ page: number; url: string | null }[]>([]);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        router.replace("/merchant/login");
      } else {
        setCheckingSession(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!detail?.metadata || !(detail.metadata as any).page_previews) {
      setPagePreviews([]);
      return;
    }
    const previews = ((detail.metadata as any).page_previews as { page: number; path: string }[]) ?? [];
    Promise.all(
      previews.map(async (preview) => ({
        page: preview.page,
        url: await signPreview(preview.path),
      })),
    ).then(setPagePreviews);
  }, [detail?.metadata, signPreview]);

  useEffect(() => {
    if (menus.length > 0 && !selectedMenu) {
      setSelectedMenu(menus[0]?.id);
    }
  }, [menus, selectedMenu]);

  const filteredItems = useMemo(() => {
    if (!detail) return [];
    return detail.staging.filter((item) => {
      if (item.confidence === null || item.confidence === undefined) {
        return true;
      }
      return item.confidence >= confidenceFloor;
    });
  }, [detail, confidenceFloor]);

  const handlePriceBlur = (itemId: string, ingestionId: string, value: string) => {
    const trimmed = value.trim();
    const cents = trimmed ? Math.round(Number.parseFloat(trimmed) * 100) : null;
    if (Number.isNaN(cents as number)) {
      return;
    }
    updateItem.mutate({ ingestionId, itemId, patch: { price_cents: cents } });
  };

  const handlePublish = async () => {
    if (!selectedMenu || !detail) return;
    await publish.mutateAsync({ ingestionId: detail.id, menuId: selectedMenu });
    router.push("/merchant/menu");
  };

  const handleReprocess = async () => {
    if (!detail) return;
    await reprocess.mutateAsync({ ingestionId: detail.id });
    await refetch();
  };

  const isBusy = publish.isPending || updateItem.isPending || reprocess.isPending;

  if (checkingSession) {
    return (
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-10 text-white">
        Checking session…
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      {profile?.onboardingStep && profile.onboardingStep !== "done" && (
        <Alert className="border-white/10 bg-amber-500/10 text-white">
          <AlertDescription>
            Publishing drafts is usually the final onboarding step. Current step: {profile.onboardingStep}. Visit settings if needed.
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Unable to load draft</AlertTitle>
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {isLoading && (
        <div className="grid gap-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      )}

      {detail && (
        <>
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">Ingestion #{detail.id.slice(0, 8)}</p>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                {detail.originalFilename ?? "Menu ingestion draft"}
              </h1>
              <p className="text-sm text-white/70">
                {detail.itemsCount} items detected across {detail.pagesProcessed} pages. Adjust flagged rows below then publish to menu.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="ghost" onClick={handleReprocess} disabled={isBusy} className="gap-2">
                <RefreshCw className="h-4 w-4" /> Re-run OCR
              </Button>
              <Button onClick={handlePublish} disabled={isBusy || !selectedMenu} className="gap-2">
                <CheckCircle2 className="h-4 w-4" /> Publish to menu
              </Button>
            </div>
          </header>

          <Card className="glass-card border-white/10 bg-white/5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Publish target</h2>
                <p className="text-xs text-white/60">Choose which menu to update. Publishing bumps version and refreshes embeddings.</p>
              </div>
              <Select value={selectedMenu} onValueChange={setSelectedMenu} disabled={isBusy || menus.length === 0}>
                <SelectTrigger className="w-72 border-white/20 bg-black/30 text-white">
                  <SelectValue placeholder="Select menu" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-black/80 text-white">
                  {menus.map((menu) => (
                    <SelectItem key={menu.id} value={menu.id}>
                      {menu.name} · v{menu.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          <Card className="glass-card border-white/10 bg-white/5 p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Confidence filter</h2>
                <p className="text-xs text-white/60">Hide low-confidence rows until they are reviewed.</p>
              </div>
              <div className="flex items-center gap-4">
                <Slider
                  className="w-48"
                  value={[confidenceFloor]}
                  min={0}
                  max={1}
                  step={0.05}
                  onValueChange={([value]) => setConfidenceFloor(value)}
                />
                <span className="text-xs text-white/70">≥ {(confidenceFloor * 100).toFixed(0)}%</span>
              </div>
            </div>
          </Card>

          {pagePreviews.length > 0 && (
            <Card className="glass-card border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold text-white">Original pages</h2>
              <Separator className="my-4 bg-white/10" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pagePreviews.map((preview) => (
                  <figure key={preview.page} className="overflow-hidden rounded-3xl border border-white/10 bg-black/40">
                    {preview.url ? (
                      <img src={preview.url} alt={`Page ${preview.page}`} className="h-64 w-full object-cover" />
                    ) : (
                      <Skeleton className="h-64 w-full" />
                    )}
                    <figcaption className="px-4 py-2 text-xs text-white/60">Page {preview.page}</figcaption>
                  </figure>
                ))}
              </div>
            </Card>
          )}

          <Card className="glass-card border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Draft items ({filteredItems.length})</h2>
              <p className="text-xs text-white/50">Edit before publish. Flags highlight rows needing attention.</p>
            </div>
            <Separator className="my-4 bg-white/10" />
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-32">Price ({detail.currency ?? ""})</TableHead>
                    <TableHead>Allergens</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Alcohol</TableHead>
                    <TableHead>Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id} className="align-top">
                      <TableCell className="min-w-[150px] text-sm text-white">
                        <Input
                          defaultValue={item.categoryName ?? ""}
                          onBlur={(event) =>
                            updateItem.mutate({
                              ingestionId: detail.id,
                              itemId: item.id,
                              patch: { category_name: event.target.value || null },
                            })
                          }
                          className="border-white/10 bg-black/30 text-white"
                        />
                      </TableCell>
                      <TableCell className="w-48 text-sm font-semibold text-white">{item.name}</TableCell>
                      <TableCell className="min-w-[260px] text-sm text-white/80">
                        <Textarea
                          defaultValue={item.description ?? ""}
                          onBlur={(event) =>
                            updateItem.mutate({
                              ingestionId: detail.id,
                              itemId: item.id,
                              patch: { description: event.target.value || null },
                            })
                          }
                          className="min-h-[90px] border-white/10 bg-black/20 text-white"
                        />
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.flags?.high_price && <Badge variant="destructive">High price</Badge>}
                          {item.flags?.missing_price && <Badge variant="outline">Missing price</Badge>}
                          {item.flags?.low_confidence && <Badge variant="secondary">Low confidence</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          defaultValue={item.priceCents ? (item.priceCents / 100).toFixed(2) : ""}
                          onBlur={(event) => handlePriceBlur(item.id, detail.id, event.target.value)}
                          className="border-white/10 bg-black/30 text-right text-white"
                          inputMode="decimal"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          defaultValue={item.allergens.join(", ")}
                          onBlur={(event) =>
                            updateItem.mutate({
                              ingestionId: detail.id,
                              itemId: item.id,
                              patch: { allergens: event.target.value ? event.target.value.split(/,\s*/) : [] },
                            })
                          }
                          className="border-white/10 bg-black/30 text-white"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          defaultValue={item.tags.join(", ")}
                          onBlur={(event) =>
                            updateItem.mutate({
                              ingestionId: detail.id,
                              itemId: item.id,
                              patch: { tags: event.target.value ? event.target.value.split(/,\s*/) : [] },
                            })
                          }
                          className="border-white/10 bg-black/30 text-white"
                        />
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={item.isAlcohol}
                          onCheckedChange={(checked) =>
                            updateItem.mutate({
                              ingestionId: detail.id,
                              itemId: item.id,
                              patch: { is_alcohol: checked },
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="w-28 text-xs text-white/70">
                        {item.confidence !== null && item.confidence !== undefined
                          ? `${Math.round(item.confidence * 100)}%`
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
