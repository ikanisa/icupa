import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ComplianceNoticeType = "ai_disclosure" | "privacy_notice";

export interface ComplianceNotice {
  id: string | null;
  tenantId: string | null;
  region: "RW" | "EU";
  noticeType: ComplianceNoticeType;
  surface: string;
  content: string;
  lastReviewedAt: string | null;
  scope: "tenant" | "default";
}

interface NoticeRow {
  id: string | null;
  tenant_id: string | null;
  region: "RW" | "EU";
  notice_type: ComplianceNoticeType;
  surface: string;
  content: string;
  last_reviewed_at: string | null;
}

const NOTICE_QUERY_TTL = 30_000;

function transformRow(row: NoticeRow, tenantId: string): ComplianceNotice {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    region: row.region,
    noticeType: row.notice_type,
    surface: row.surface,
    content: row.content,
    lastReviewedAt: row.last_reviewed_at,
    scope: row.tenant_id === tenantId ? "tenant" : "default",
  };
}

async function fetchComplianceNotices(tenantId: string, region: "RW" | "EU"): Promise<ComplianceNotice[]> {
  const query = supabase
    .from("compliance_notice_templates")
    .select("id, tenant_id, region, notice_type, surface, content, last_reviewed_at")
    .eq("region", region)
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const grouped = new Map<string, ComplianceNotice>();

  (data as NoticeRow[] | null)?.forEach((row) => {
    const key = `${row.notice_type}:${row.surface}`;
    const notice = transformRow(row, tenantId);
    if (!grouped.has(key) || grouped.get(key)?.tenantId === null) {
      grouped.set(key, notice);
    }
  });

  return Array.from(grouped.values());
}

export function useComplianceNotices(tenantId: string | null, region: "RW" | "EU") {
  return useQuery({
    queryKey: ["admin", "compliance-notices", tenantId, region],
    queryFn: () => fetchComplianceNotices(tenantId ?? "", region),
    enabled: Boolean(tenantId),
    staleTime: NOTICE_QUERY_TTL,
  });
}

export interface SaveComplianceNoticeInput {
  tenantId: string;
  region: "RW" | "EU";
  noticeType: ComplianceNoticeType;
  surface: string;
  content: string;
  sourceId?: string | null;
  scope: "tenant" | "default";
  markReviewed?: boolean;
}

async function saveComplianceNotice(input: SaveComplianceNoticeInput) {
  const timestamp = input.markReviewed ? new Date().toISOString() : undefined;

  if (input.scope === "tenant" && input.sourceId) {
    const payload: Record<string, unknown> = { content: input.content };
    if (timestamp) {
      payload.last_reviewed_at = timestamp;
    }

    const { error } = await supabase
      .from("compliance_notice_templates")
      .update(payload)
      .eq("id", input.sourceId)
      .eq("tenant_id", input.tenantId);

    if (error) {
      throw error;
    }
    return;
  }

  const insertPayload: Record<string, unknown> = {
    tenant_id: input.tenantId,
    region: input.region,
    notice_type: input.noticeType,
    surface: input.surface,
    content: input.content,
  };

  if (timestamp) {
    insertPayload.last_reviewed_at = timestamp;
  }

  const { error } = await supabase.from("compliance_notice_templates").insert([insertPayload]);

  if (error) {
    throw error;
  }
}

export function useSaveComplianceNotice(tenantId: string | null, region: "RW" | "EU") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveComplianceNoticeInput) => saveComplianceNotice(input),
    onSuccess: (_, variables) => {
      if (!tenantId) return;
      queryClient.invalidateQueries({ queryKey: ["admin", "compliance-notices", tenantId, region] });
      if (variables.tenantId !== tenantId) {
        queryClient.invalidateQueries({ queryKey: ["admin", "compliance-notices", variables.tenantId, region] });
      }
    },
  });
}
