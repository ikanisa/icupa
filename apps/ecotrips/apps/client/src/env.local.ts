import { assertSupabasePublicEnv } from "@ecotrips/config/env";

export const publicEnv = assertSupabasePublicEnv(process.env);

export type PublicEnv = typeof publicEnv;
