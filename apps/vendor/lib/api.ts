import { loadClientEnv } from '@icupa/config/env';
import {
  kpiMetrics,
  slaSignals,
  liveAlerts,
  kdsLanes,
  floorTables,
  liveOrders,
  menuIngestions,
  ingestionDraft,
  inventoryLevels,
  promoCampaigns,
  onboardingChecklist,
  quickIntents,
} from '../data/sample';

type HttpMethod = 'POST' | 'GET';

const getFunctionUrl = (path: string) => {
  const env = loadClientEnv();
  return {
    url: `${env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${path}`,
    key: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
};

const supabaseFetch = async <T>(path: string, method: HttpMethod, body?: Record<string, unknown>): Promise<T> => {
  try {
    const { url, key } = getFunctionUrl(path);
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Supabase function ${path} failed: ${response.status} ${errorBody}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    console.warn('[vendor] Falling back to mocked response for', path, error);
    return {} as T;
  }
};

export type SendOtpResponse = {
  request_id?: string;
  expires_at?: string;
};

export const sendWhatsAppOtp = async (phoneE164: string): Promise<SendOtpResponse> =>
  supabaseFetch<SendOtpResponse>('auth/whatsapp_send_otp', 'POST', { phone: phoneE164 });

export type VerifyOtpResponse = {
  session?: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
  };
  user?: {
    id: string;
    phone?: string;
  };
};

export const verifyWhatsAppOtp = async (phoneE164: string, otp: string): Promise<VerifyOtpResponse> =>
  supabaseFetch<VerifyOtpResponse>('auth/whatsapp_verify_otp', 'POST', { phone: phoneE164, otp });

export const fetchDashboardSnapshot = async () => ({
  metrics: kpiMetrics,
  slaSignals,
  alerts: liveAlerts,
  quickIntents,
});

export const fetchKdsBoard = async () => kdsLanes;

export const fetchFloorStatus = async () => floorTables;

export const fetchOrders = async () => liveOrders;

export const fetchMenuIngestions = async () => menuIngestions;

export const fetchIngestionDraft = async (ingestionId: string) => ({
  ...ingestionDraft,
  id: ingestionId,
});

export const startMenuIngestion = async (payload: { fileName: string; notes?: string }) =>
  supabaseFetch<{ ingestion_id: string }>('ingest_menu_start', 'POST', payload);

export const fetchInventory = async () => inventoryLevels;

export const fetchPromos = async () => promoCampaigns;

export const fetchOnboardingChecklist = async () => onboardingChecklist;
