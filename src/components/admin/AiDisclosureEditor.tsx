import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ComplianceNotice,
  useComplianceNotices,
  useSaveComplianceNotice,
} from "@/hooks/useComplianceNotices";
import { useToast } from "@/components/ui/use-toast";

interface AiDisclosureEditorProps {
  tenantId: string | null;
  tenantRegion: "RW" | "EU";
}

interface NoticeDefinition {
  noticeType: ComplianceNotice["noticeType"];
  surface: string;
  label: string;
  helper: string;
}

const RW_DEFINITIONS: NoticeDefinition[] = [
  {
    noticeType: "ai_disclosure",
    surface: "diner_chat",
    label: "Diner AI disclosure",
    helper: "Displayed before the Rwanda diner AI assistant responds.",
  },
  {
    noticeType: "privacy_notice",
    surface: "rwanda_dpl",
    label: "Rwanda DPL notice",
    helper: "Links to the Rwanda privacy statement in the client footer.",
  },
];

const EU_DEFINITIONS: NoticeDefinition[] = [
  {
    noticeType: "ai_disclosure",
    surface: "diner_chat",
    label: "Diner AI disclosure",
    helper: "Shown before the Malta diner AI assistant replies.",
  },
  {
    noticeType: "privacy_notice",
    surface: "gdpr_footer",
    label: "GDPR privacy notice",
    helper: "Footer text covering controller info and GDPR rights.",
  },
];

function keyFor(definition: NoticeDefinition) {
  return `${definition.noticeType}:${definition.surface}`;
}

export function AiDisclosureEditor({ tenantId, tenantRegion }: AiDisclosureEditorProps) {
  const definitions = tenantRegion === "RW" ? RW_DEFINITIONS : EU_DEFINITIONS;
  const { data, isLoading } = useComplianceNotices(tenantId, tenantRegion);
  const saveNotice = useSaveComplianceNotice(tenantId, tenantRegion);
  const { toast } = useToast();

  const drafts = useMemo(() => {
    const initial = new Map<string, ComplianceNotice>();
    data?.forEach((notice) => {
      initial.set(`${notice.noticeType}:${notice.surface}`, notice);
    });
    return initial;
  }, [data]);

  const [contentState, setContentState] = useState<Record<string, string>>({});

  useEffect(() => {
    const nextState: Record<string, string> = {};
    definitions.forEach((definition) => {
      const key = keyFor(definition);
      const notice = drafts.get(key);
      nextState[key] = notice?.content ?? "";
    });
    setContentState(nextState);
  }, [definitions, drafts]);

  if (!tenantId) {
    return null;
  }

  if (isLoading) {
    return <Skeleton className="h-48 w-full bg-white/10" />;
  }

  const handleSave = async (definition: NoticeDefinition, markReviewed = false) => {
    const key = keyFor(definition);
    const existing = drafts.get(key);

    try {
      await saveNotice.mutateAsync({
        tenantId,
        region: tenantRegion,
        noticeType: definition.noticeType,
        surface: definition.surface,
        content: contentState[key] ?? "",
        sourceId: existing?.id ?? undefined,
        scope: existing?.scope ?? "default",
        markReviewed,
      });
      toast({ title: markReviewed ? "Marked as reviewed" : "Notice updated" });
    } catch (error: any) {
      console.error("save compliance notice failed", error);
      toast({
        title: "Unable to update notice",
        description: error?.message ?? "Unexpected error while saving the notice.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {definitions.map((definition) => {
        const key = keyFor(definition);
        const notice = drafts.get(key);
        const lastReviewed = notice?.lastReviewedAt ? new Date(notice.lastReviewedAt) : null;
        return (
          <Card key={key} className="glass-card border border-white/10 bg-white/10 p-5 text-white">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-white/60">{definition.label}</p>
                <p className="text-sm text-white/60">{definition.helper}</p>
              </div>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <Badge variant="outline" className="border-white/20 text-xs text-white/70">
                  {notice?.scope === "tenant" ? "Tenant override" : "Default copy"}
                </Badge>
                {lastReviewed ? (
                  <p className="text-xs text-white/60">Reviewed {lastReviewed.toLocaleString()}</p>
                ) : (
                  <p className="text-xs text-white/60">Not yet reviewed</p>
                )}
              </div>
            </div>

            <Textarea
              value={contentState[key] ?? ""}
              onChange={(event) =>
                setContentState((prev) => ({
                  ...prev,
                  [key]: event.target.value,
                }))
              }
              className="mt-4 min-h-[120px] bg-white/10 text-white placeholder:text-white/40"
              placeholder="Describe how AI is used and where diners can escalate to a human."
            />

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                className="rounded-xl bg-white/90 px-4 py-2 font-semibold text-primary hover:bg-white"
                disabled={saveNotice.isPending}
                onClick={() => handleSave(definition, false)}
              >
                {saveNotice.isPending ? "Saving…" : "Save copy"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/20"
                disabled={saveNotice.isPending}
                onClick={() => handleSave(definition, true)}
              >
                Mark reviewed
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
