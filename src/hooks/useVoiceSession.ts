import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTableSessionHeader } from "@/lib/table-session";

const VOICE_FUNCTION_PATH = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice/session`;

async function requestVoiceSession() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Supabase session required for voice waiter');
  }

  const tableSession = getTableSessionHeader();
  if (!tableSession) {
    throw new Error('Linked table session required before starting voice waiter');
  }

  const response = await fetch(VOICE_FUNCTION_PATH, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-icupa-session': tableSession,
    },
    body: '{}',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error?.message ?? 'Unable to start voice session');
  }

  return (await response.json()) as {
    token: string;
    expires_at: string;
    realtime_api_key: string;
    realtime_base_url: string;
    model: string;
  };
}

export function useVoiceSession() {
  return useMutation({
    mutationFn: requestVoiceSession,
  });
}
