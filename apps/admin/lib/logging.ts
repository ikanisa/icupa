const scope = "ops.console" as const;

export function logAdminAction(event: string, fields: Record<string, unknown>) {
  const entry = {
    level: "info",
    scope,
    event,
    timestamp: new Date().toISOString(),
    ...fields,
  };
  console.log(JSON.stringify(entry));
}
