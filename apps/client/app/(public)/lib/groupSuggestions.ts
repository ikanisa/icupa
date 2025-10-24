import { createEcoTripsFunctionClient } from "@ecotrips/api";
import type { GroupSuggestionInput, GroupSuggestionResponse } from "@ecotrips/types";

export async function requestGroupSuggestions(
  input: Partial<GroupSuggestionInput> = {},
): Promise<GroupSuggestionResponse> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return {
      ok: false,
      suggestions: [],
      follow_up: undefined,
      session_id: input.session_id,
      request_id: undefined,
    };
  }

  const client = createEcoTripsFunctionClient({
    supabaseUrl,
    anonKey,
    getAccessToken: async () => null,
  });

  try {
    const response = await client.call("groups.suggest", input as GroupSuggestionInput);
    return response;
  } catch (error) {
    console.error("groups.suggest", error);
    return {
      ok: false,
      suggestions: [],
      follow_up: undefined,
      session_id: input.session_id,
      request_id: undefined,
    };
  }
}
