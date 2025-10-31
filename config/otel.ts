import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

/**
 * Initialize and start OpenTelemetry instrumentation
 */
export function startOTel(): void {
  const serviceName =
    process.env.OTEL_SERVICE_NAME || process.env.SERVICE_NAME || "ai-agents";
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  // Only start if endpoint is configured
  if (!endpoint) {
    console.log("OTEL_EXPORTER_OTLP_ENDPOINT not set, skipping telemetry setup");
    return;
  }

  const exporter = new OTLPTraceExporter({
    url: endpoint,
    headers: parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS),
  });

  const sdk = new NodeSDK({
    traceExporter: exporter,
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
    }),
  });

  sdk.start();

  // Graceful shutdown
  process.on("SIGTERM", () => {
    sdk
      .shutdown()
      .then(() => console.log("Telemetry terminated"))
      .catch((error) => console.error("Error terminating telemetry", error));
  });

  console.log(`OpenTelemetry initialized for service: ${serviceName}`);
}

/**
 * Parse headers from environment variable
 * Format: "key1=value1,key2=value2"
 */
function parseHeaders(headersStr?: string): Record<string, string> {
  if (!headersStr) return {};

  const headers: Record<string, string> = {};
  headersStr.split(",").forEach((pair) => {
    const [key, value] = pair.split("=");
    if (key && value) {
      headers[key.trim()] = value.trim();
    }
  });
  return headers;
}
