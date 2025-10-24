const WEBHOOK_URL = process.env.OPS_BYPASS_ALERT_WEBHOOK_URL?.trim();

export type BypassAlertContext = {
  page: string;
  toggles: string[];
  reason: string;
};

export async function emitBypassAlert(context: BypassAlertContext) {
  const payload = {
    level: "ERROR",
    event: "ops.console.offline_mode_detected",
    ...context,
    timestamp: new Date().toISOString(),
  };

  if (!WEBHOOK_URL) {
    console.error(JSON.stringify(payload));
    return;
  }

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.error(
        JSON.stringify({
          ...payload,
          event: "ops.console.offline_mode_alert_failed",
          status: response.status,
        }),
      );
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        ...payload,
        event: "ops.console.offline_mode_alert_error",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
