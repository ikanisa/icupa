import { registerOTel } from '@vercel/otel';

export function register() {
  registerOTel({
    serviceName: 'icupa-admin',
    serviceVersion: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local',
    traceExporterEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    traceExporterHeaders: process.env.OTEL_EXPORTER_OTLP_HEADERS,
  });
}
