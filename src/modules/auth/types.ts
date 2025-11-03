export type AppUserRole = "guest" | "client" | "merchant" | "admin";

export interface AuthSnapshot {
  status: "loading" | "authenticated" | "unauthenticated";
  roles: AppUserRole[];
  email?: string;
  refresh: () => Promise<void>;
}
