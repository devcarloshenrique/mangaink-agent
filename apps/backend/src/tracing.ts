/**
 * Instrumentação OpenTelemetry (traces + métricas).
 *
 * Deve ser o PRIMEIRO import de src/app.ts para que as auto-instrumentações
 * (http, ioredis, pg, prisma, bullmq) capturem todos os spans da aplicação.
 *
 * Env vars:
 * - OTEL_EXPORTER_OTLP_ENDPOINT (default: http://127.0.0.1:4317 — evita o IPv6 ::1 do Windows)
 * - OTEL_SERVICE_NAME (default: mangaink-api)
 * - OTEL_METRICS_EXPORT_INTERVAL_MS (default: 10000)
 * - OTEL_SDK_DISABLED=true desliga toda a instrumentação (usado em testes)
 */
import { NodeSDK } from '@opentelemetry/sdk-node'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc'
import { RuntimeNodeInstrumentation } from '@opentelemetry/instrumentation-runtime-node'
import { HostMetricsInstrumentation } from '@opentelemetry/instrumentation-host-metrics'
import { PrismaInstrumentation } from '@prisma/instrumentation'

process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??= 'http://127.0.0.1:4317'
process.env.OTEL_SERVICE_NAME ??= 'mangaink-api'

const disabled = process.env.OTEL_SDK_DISABLED === 'true'

let sdk: NodeSDK | null = null

if (!disabled) {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT

  sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME,
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: endpoint }),
      exportIntervalMillis: Number(process.env.OTEL_METRICS_EXPORT_INTERVAL_MS ?? 10_000),
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
      new PrismaInstrumentation(),
      new RuntimeNodeInstrumentation(),
      new HostMetricsInstrumentation(),
    ],
  })

  sdk.start()
}

export async function shutdownTracing(): Promise<void> {
  await sdk?.shutdown()
}
