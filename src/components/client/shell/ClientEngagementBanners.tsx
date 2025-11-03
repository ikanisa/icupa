import { Fragment } from "react";
import { motion } from "framer-motion";
import { Button } from "@icupa/ui/button";
import { Bell, AlertTriangle, WifiOff, RotateCw } from "lucide-react";
import type { UsePushSubscriptionResult } from "@/hooks/usePushSubscription";

interface InstallStatus {
  isIos: boolean;
  isStandalone: boolean;
  installAvailable: boolean;
}

interface ClientEngagementBannersProps {
  ageGateChoice: "unknown" | "verified" | "declined";
  shouldShowInstallBanner: boolean;
  installStatus: InstallStatus;
  onPromptInstall: () => void;
  onDismissInstall: () => void;
  shouldShowPushCard: boolean;
  pushSubscription: UsePushSubscriptionResult;
  pushButtonDisabled: boolean;
  verifyButtonDisabled: boolean;
  disableButtonDisabled: boolean;
  menuSource: string;
  menuError: boolean;
  onRetryMenu: () => void;
  isOnline: boolean;
  offlineSinceLabel: string;
  prefersReducedMotion: boolean;
}

export function ClientEngagementBanners({
  ageGateChoice,
  shouldShowInstallBanner,
  installStatus,
  onPromptInstall,
  onDismissInstall,
  shouldShowPushCard,
  pushSubscription,
  pushButtonDisabled,
  verifyButtonDisabled,
  disableButtonDisabled,
  menuSource,
  menuError,
  onRetryMenu,
  isOnline,
  offlineSinceLabel,
  prefersReducedMotion,
}: ClientEngagementBannersProps) {
  return (
    <div className="space-y-3">
      {ageGateChoice === "declined" && (
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-3"
        >
          <div className="glass-card rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4" role="status">
            <p className="text-sm font-semibold text-amber-100">Serving non-alcoholic experience</p>
            <p className="text-xs text-amber-100/80">
              Alcoholic items are hidden until a manager verifies the table. Ask staff if you need assistance.
            </p>
          </div>
        </motion.div>
      )}

      {shouldShowInstallBanner && (
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-3"
        >
          <div className="glass-card rounded-2xl border border-border/40 p-4 flex flex-col gap-3" role="status">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="text-sm font-semibold">Install ICUPA for quick access</p>
                {installStatus.installAvailable ? (
                  <p className="text-xs text-muted-foreground">
                    Add the app to your home screen for offline access and faster launches.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    On iOS tap the share icon in Safari, then choose <strong>Add to Home Screen</strong> to enable push
                    updates and offline menu browsing.
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label="Dismiss install guidance"
                onClick={onDismissInstall}
              >
                ×
              </Button>
            </div>
            {installStatus.installAvailable && !installStatus.isStandalone && (
              <div className="flex gap-2">
                <Button onClick={onPromptInstall} className="flex-1">
                  Install now
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {shouldShowPushCard && (
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-3"
        >
          <div className="glass-card rounded-2xl border border-border/40 p-4" role="status">
            <div className="flex items-start gap-3">
              <div className="mt-1 rounded-full bg-primary/10 text-primary p-2" aria-hidden="true">
                <Bell className="w-4 h-4" />
              </div>
              <div className="space-y-2 flex-1">
                <div>
                  <p className="text-sm font-semibold">
                    {pushSubscription.isSubscribed ? "Alerts enabled" : "Enable instant updates"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {pushSubscription.isSubscribed
                      ? "Send a test notification or disable alerts if you no longer need realtime updates."
                      : "Get notified when receipts are issued or an order status changes, even if you close the app."}
                  </p>
                </div>
                {pushSubscription.shouldShowIosInstallHint && (
                  <p className="text-xs text-muted-foreground">
                    Install ICUPA from Safari (Share → <strong>Add to Home Screen</strong>) before enabling push alerts on iOS.
                  </p>
                )}
                {pushSubscription.permission === "denied" && (
                  <p className="text-xs text-warning-foreground">
                    Notifications are blocked in your browser preferences. Re-enable them to receive updates.
                  </p>
                )}
                {pushSubscription.error && pushSubscription.permission !== "denied" && (
                  <p className="text-xs text-destructive">{pushSubscription.error}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {!pushSubscription.isSubscribed ? (
                    <Button
                      onClick={() => void pushSubscription.subscribe()}
                      disabled={pushButtonDisabled}
                      variant="secondary"
                      size="sm"
                      className="rounded-full"
                    >
                      {pushSubscription.isSubscribing ? "Enabling…" : "Enable alerts"}
                    </Button>
                  ) : (
                    <Fragment>
                      <Button
                        onClick={() => void pushSubscription.verify()}
                        disabled={verifyButtonDisabled}
                        variant="secondary"
                        size="sm"
                        className="rounded-full"
                      >
                        {pushSubscription.isVerifying ? "Sending test…" : "Send test alert"}
                      </Button>
                      <Button
                        onClick={() => void pushSubscription.unsubscribe()}
                        disabled={disableButtonDisabled}
                        variant="ghost"
                        size="sm"
                        className="rounded-full"
                      >
                        {pushSubscription.isUnsubscribing ? "Disabling…" : "Disable alerts"}
                      </Button>
                    </Fragment>
                  )}
                </div>
                {pushSubscription.verificationStatus === "delivered" && (
                  <p className="text-xs text-success">
                    Test notification queued. Check your device to confirm push alerts are working.
                  </p>
                )}
                {pushSubscription.verificationStatus === "error" && !pushSubscription.error && (
                  <p className="text-xs text-destructive">
                    We could not send a test notification. Please try again in a moment.
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {menuSource === "static" && menuError && (
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-3"
          role="status"
          aria-live="polite"
        >
          <div className="glass-card rounded-2xl border border-warning/40 p-4 flex flex-col gap-3 text-warning-foreground">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">Showing cached menu</p>
                <p className="text-xs opacity-90">
                  We couldn’t reach Supabase just now. You can keep browsing offline and retry when you’re ready.
                </p>
              </div>
            </div>
            <div>
              <Button
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={onRetryMenu}
              >
                <RotateCw className="w-3 h-3" />
                Try again
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {!isOnline && (
        <motion.div
          initial={prefersReducedMotion ? undefined : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mt-3"
          role="status"
          aria-live="polite"
        >
          <div className="glass-card rounded-2xl border border-warning/40 p-4 flex gap-3 text-warning-foreground">
            <div className="mt-0.5">
              <WifiOff className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">You’re offline</p>
              <p className="text-xs opacity-90">
                Browse the saved menu and update your cart. We’ll sync your table once you’re back online
                {offlineSinceLabel ? ` (since ${offlineSinceLabel})` : "."}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
