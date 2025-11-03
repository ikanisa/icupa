import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@icupa/ui/use-toast";
import { ToastAction } from "@icupa/ui/toast";
import { addOfflineReadyListener, addPwaUpdateListener } from "@/lib/serviceWorker";

export const usePwaNotifications = () => {
  const { t } = useTranslation();

  useEffect(() => {
    const cleanupUpdate = addPwaUpdateListener(({ refresh }) => {
      toast({
        title: t("app.updateTitle"),
        description: t("app.updateDescription"),
        action: (
          <ToastAction altText={t("app.reloadCta")} onClick={() => refresh()}>
            {t("app.reloadCta")}
          </ToastAction>
        ),
      });
    });

    const cleanupOffline = addOfflineReadyListener(() => {
      toast({
        title: t("app.offlineTitle"),
        description: t("app.offlineDescription"),
      });
    });

    return () => {
      cleanupUpdate();
      cleanupOffline();
    };
  }, [t]);
};
