import { env } from 'process';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | undefined;

function parseOtelHeaders(value?: string): Record<string, string> | undefined {
  if (!value) return undefined;

  const headers: Record<string, string> = {};
  for (const segment of value.split(',')) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const [rawKey, ...rawValue] = trimmed.split('=');
    const key = rawKey?.trim();
    const val = rawValue.join('=').trim();
    if (!key || !val) continue;
    headers[key] = val;
  }

  return Object.keys(headers).length ? headers : undefined;
}

function startTelemetry() {
  const endpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    return;
  }

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

  sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: env.OTEL_SERVICE_NAME ?? 'icupa-agents-service',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: env.NODE_ENV ?? 'development',
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${endpoint.replace(/\/$/, '')}/v1/traces`,
      headers: parseOtelHeaders(env.OTEL_EXPORTER_OTLP_HEADERS),
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  try {
    sdk.start();
  } catch (error) {
    console.error('Failed to start OpenTelemetry SDK', error);
  }

  const shutdown = async () => {
    try {
      await sdk?.shutdown();
    } catch (error) {
      console.error('OpenTelemetry shutdown failed', error);
    } finally {
      process.exit(0);
    }
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

startTelemetry();

export {}; // ensure treated as module
