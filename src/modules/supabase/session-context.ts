import { createContext, useContext } from "react";

type SessionHeaders = Record<string, string>;

export const SupabaseSessionContext = createContext<SessionHeaders>({});

export const useSupabaseSessionHeaders = () => useContext(SupabaseSessionContext);
