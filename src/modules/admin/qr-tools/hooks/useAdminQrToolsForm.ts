import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { useSupabaseSessionHeaders } from "@/modules/supabase";
import type { AdminQrFormState, ReissueResponse } from "../types";

const INITIAL_FORM_STATE: AdminQrFormState = {
  tableId: "",
  adminToken: "",
};

const stripAuthorizationHeader = (headers: Record<string, string>) => {
  const entries = Object.entries(headers).filter(([key]) => key.toLowerCase() !== "authorization");
  return Object.fromEntries(entries);
};

export const useAdminQrToolsForm = () => {
  const [form, setForm] = useState<AdminQrFormState>(INITIAL_FORM_STATE);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReissueResponse | null>(null);
  const sessionHeaders = useSupabaseSessionHeaders();

  const updateField = useCallback(<Key extends keyof AdminQrFormState>(key: Key, value: AdminQrFormState[Key]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetForm = useCallback(() => {
    setForm(INITIAL_FORM_STATE);
    setResult(null);
  }, []);

  const submit = useCallback(async () => {
    if (!form.tableId || !form.adminToken) {
      toast({
        title: "Missing details",
        description: "Provide both the table identifier and admin token before re-issuing a QR code.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const sanitizedHeaders = stripAuthorizationHeader(sessionHeaders);
      const { data, error } = await supabase.functions.invoke<ReissueResponse>("admin/reissue_table_qr", {
        body: {
          table_id: form.tableId.trim(),
        },
        headers: {
          ...sanitizedHeaders,
          Authorization: `Bearer ${form.adminToken.trim()}`,
        },
      });

      if (error || !data) {
        throw new Error(error?.message ?? "Unable to re-issue QR code");
      }

      setResult(data);
      toast({
        title: "QR code rotated",
        description: "Distribute the refreshed QR link to replace any previous table signage.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      toast({
        title: "QR rotation failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setForm((prev) => ({ ...prev, adminToken: "" }));
    }
  }, [form.adminToken, form.tableId, sessionHeaders]);

  return useMemo(
    () => ({
      form,
      loading,
      result,
      updateField,
      submit,
      resetForm,
    }),
    [form, loading, resetForm, result, submit, updateField],
  );
};
