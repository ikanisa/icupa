import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { env } from '../../config/env.js';

let sdk: NodeSDK | undefined;

export const startTracing = () => {
  if (sdk) return sdk;
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);
  sdk = new NodeSDK({
    traceExporter: env.OTEL_EXPORTER_OTLP_ENDPOINT
      ? new OTLPTraceExporter({ url: env.OTEL_EXPORTER_OTLP_ENDPOINT })
      : undefined,
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'icupa-api'
    })
  });
  sdk.start().catch((error) => {
    console.error('Failed to start OpenTelemetry SDK', error);
  });
  return sdk;
};

export const stopTracing = async () => {
  if (!sdk) return;
  await sdk.shutdown();
  sdk = undefined;
};
