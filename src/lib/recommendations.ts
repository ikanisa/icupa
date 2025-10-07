import { supabase } from "@/integrations/supabase/client";

export async function markRecommendationAccepted(impressionId: string): Promise<void> {
  if (!impressionId) return;

  const { error } = await supabase.rpc("accept_recommendation_impression", {
    impression_id: impressionId,
  });

  if (error) {
    throw new Error(error.message);
  }
}
