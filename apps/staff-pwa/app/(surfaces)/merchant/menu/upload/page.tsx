"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CloudUpload, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@icupa/ui/button";
import { Card } from "@icupa/ui/card";
import { Input } from "@icupa/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@icupa/ui/select";
import { Separator } from "@icupa/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@icupa/ui/alert";
import { useMerchantLocations } from "@/hooks/useMerchantLocations";
import { useProcessIngestion } from "@/hooks/useMenuIngestionPipeline";
import { supabase } from "@/lib/supabase-client";
import { useMutation } from "@tanstack/react-query";
import { useMerchantProfile } from "@/hooks/useMerchantProfile";

interface IngestStartResponse {
  ingestion_id: string;
  upload_url?: string;
  storage_path: string;
  status: string;
}

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];

export default function MerchantMenuUploadPage() {
  const router = useRouter();
  const { data: locations = [], isLoading: loadingLocations } = useMerchantLocations();
  const { data: profile } = useMerchantProfile();
  const [locationId, setLocationId] = useState<string | undefined>();
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const processIngestion = useProcessIngestion();
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
    if (locations.length > 0 && !locationId) {
      setLocationId(locations[0]?.id);
    }
  }, [locations, locationId]);

  const startIngestion = useMutation({
    mutationFn: async ({ file, location }: { file: File; location: string }) => {
      setStatusMessage("Requesting upload slot…");
      setErrorMessage("");

      const { data, error } = await supabase.functions.invoke<IngestStartResponse>("ingest_menu_start", {
        body: {
          location_id: location,
          original_filename: file.name,
          file_mime: file.type || "application/octet-stream",
          request_signed_upload: true,
        },
      });

      if (error) {
        throw error;
      }

      if (!data?.ingestion_id) {
        throw new Error("Missing ingestion identifier");
      }

      if (data.upload_url) {
        setStatusMessage("Uploading file to secure storage…");
        const response = await fetch(data.upload_url, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Upload failed (${response.status}): ${text}`);
        }
      }

      setStatusMessage("Triggering OCR & AI extraction…");
      await processIngestion.mutateAsync({ ingestionId: data.ingestion_id });

      setStatusMessage("Draft created. Redirecting…");
      router.push(`/merchant/menu/review/${data.ingestion_id}`);
    },
    onError: (error: any) => {
      console.error("Ingestion upload failed", error);
      setErrorMessage(error?.message ?? "Upload failed");
      setStatusMessage("");
    },
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!locationId) {
      setErrorMessage("Choose a location first");
      return;
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setErrorMessage("Only PDF, PNG, JPG, and WEBP files are supported");
      return;
    }

    await startIngestion.mutateAsync({ file, location: locationId });
  };

  const disabled = startIngestion.isPending || processIngestion.isPending || loadingLocations;

  if (checkingSession) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-10 text-white">
        Checking session…
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Upload menu</h1>
        <p className="text-sm text-white/70">
          Drop a PDF or high-resolution image. We will OCR, structure, and flag low-confidence items for review in under 4 minutes.
        </p>
      </header>

      {profile?.onboardingStep && profile.onboardingStep !== "menu" && profile.onboardingStep !== "done" && (
        <Alert className="border-white/10 bg-amber-500/10 text-white">
          <AlertTitle>Almost there</AlertTitle>
          <AlertDescription>
            Complete onboarding steps in settings before publishing menus. Current step: {profile.onboardingStep}.
          </AlertDescription>
        </Alert>
      )}

      <Card className="glass-card border-white/10 bg-white/5 p-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.3em] text-white/60">Location</label>
            <Select onValueChange={setLocationId} disabled={disabled} value={locationId}>
              <SelectTrigger className="w-full border-white/20 bg-black/30 text-white">
                <SelectValue placeholder={loadingLocations ? "Loading locations…" : "Select location"} />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-black/80 text-white">
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name} · {location.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator className="bg-white/10" />

          <label
            htmlFor="menu-upload"
            className="flex cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-white/15 bg-black/20 p-10 text-center transition hover:border-primary/50"
          >
            <CloudUpload className="h-10 w-10 text-white/70" />
            <div>
              <p className="text-lg font-semibold text-white">Drag & drop or click to upload</p>
              <p className="text-xs text-white/60">Accepted formats: PDF, PNG, JPG, WEBP (max 25 pages)</p>
            </div>
            <Input
              id="menu-upload"
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              className="hidden"
              disabled={disabled || !locationId}
              onChange={handleFileChange}
            />
          </label>

          {statusMessage && (
            <Alert className="border-white/10 bg-primary/10 text-white">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertTitle>Processing</AlertTitle>
              <AlertDescription>{statusMessage}</AlertDescription>
            </Alert>
          )}

          {errorMessage && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Upload failed</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <p className="text-xs text-white/50">
            Tip: Upload clear scans with minimal shadows. We normalise currencies automatically and flag unusually high prices for manual review.
          </p>
        </div>
      </Card>

      <div className="flex justify-between text-xs text-white/50">
        <span>All uploads are stored in a private bucket (`raw_menus`).</span>
        <span>Processing powered by OpenAI structured outputs.</span>
      </div>
    </div>
  );
}
