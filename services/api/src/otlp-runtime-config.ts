import type {
  ObservabilityOtlpProtocol,
  ObservabilitySignal
} from "./observability-exporter-contracts.js";

export type OtlpRuntimeConfigEnv = Readonly<Record<string, string | undefined>>;

export type OtlpRuntimeHeader = {
  name: string;
  value: string;
};

export type OtlpRuntimeConfig = {
  serviceName: string;
  environment: string;
  endpoint: URL;
  protocol: ObservabilityOtlpProtocol;
  timeoutMs: number;
  headers: readonly OtlpRuntimeHeader[];
  signals: readonly ObservabilitySignal[];
};

export function otlpRuntimeConfigFromEnv(
  env: OtlpRuntimeConfigEnv
): OtlpRuntimeConfig {
  const protocol = requiredEnv(env, "OTEL_EXPORTER_OTLP_PROTOCOL");
  if (protocol !== "http/protobuf") {
    throw new Error("OTEL_EXPORTER_OTLP_PROTOCOL must be http/protobuf.");
  }

  return {
    serviceName: requiredEnv(env, "OTEL_SERVICE_NAME"),
    environment: requiredEnv(env, "SEARCHLINT_ENVIRONMENT"),
    endpoint: endpointFromEnv(env),
    protocol,
    timeoutMs: positiveIntegerFromEnv(env, "OTEL_EXPORTER_OTLP_TIMEOUT"),
    headers: headersFromEnv(env),
    signals: ["logs", "metrics"]
  };
}

function endpointFromEnv(env: OtlpRuntimeConfigEnv): URL {
  const rawEndpoint = requiredEnv(env, "OTEL_EXPORTER_OTLP_ENDPOINT");
  let endpoint: URL;
  try {
    endpoint = new URL(rawEndpoint);
  } catch {
    throw new Error("OTEL_EXPORTER_OTLP_ENDPOINT must be an absolute URL.");
  }

  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
    throw new Error("OTEL_EXPORTER_OTLP_ENDPOINT must use http or https.");
  }

  return endpoint;
}

function headersFromEnv(
  env: OtlpRuntimeConfigEnv
): readonly OtlpRuntimeHeader[] {
  const rawHeaders = optionalEnv(env, "OTEL_EXPORTER_OTLP_HEADERS");
  if (rawHeaders === undefined) {
    return [];
  }

  return rawHeaders.split(",").map((pair) => {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex <= 0 || separatorIndex === pair.length - 1) {
      throw new Error(
        "OTEL_EXPORTER_OTLP_HEADERS must contain comma-separated name=value pairs."
      );
    }

    const name = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (name.length === 0 || value.length === 0) {
      throw new Error(
        "OTEL_EXPORTER_OTLP_HEADERS must contain comma-separated name=value pairs."
      );
    }

    return {
      name,
      value
    };
  });
}

function positiveIntegerFromEnv(
  env: OtlpRuntimeConfigEnv,
  name: string
): number {
  const value = Number(requiredEnv(env, name));
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function requiredEnv(env: OtlpRuntimeConfigEnv, name: string): string {
  const value = optionalEnv(env, name);
  if (value === undefined) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function optionalEnv(
  env: OtlpRuntimeConfigEnv,
  name: string
): string | undefined {
  const value = env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}
