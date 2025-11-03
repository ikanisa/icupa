import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { toast } from "@icupa/ui/use-toast";
import { FullScreenLoader } from "@/components/layout/FullScreenLoader";
import { useAuth } from "@/modules/auth";
import type { AppUserRole } from "@/modules/auth";
import { useTranslation } from "react-i18next";

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles?: AppUserRole[];
}

export const RoleGuard = ({ children, allowedRoles }: RoleGuardProps) => {
  const { status, roles } = useAuth();
  const location = useLocation();
  const hasNotified = useRef(false);
  const { t } = useTranslation();

  const permitted = useMemo(() => {
    if (!allowedRoles || allowedRoles.length === 0) {
      return true;
    }
    return allowedRoles.some((role) => roles.includes(role));
  }, [allowedRoles, roles]);

  useEffect(() => {
    if (status !== "loading" && !permitted && !hasNotified.current) {
      hasNotified.current = true;
      toast({
        title: t("auth.deniedTitle"),
        description: t("auth.deniedDescription"),
        variant: "destructive",
      });
    }
  }, [permitted, status, t]);

  if (status === "loading") {
    return <FullScreenLoader />;
  }

  if (!permitted) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
