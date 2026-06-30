import { Pool } from "pg";

export type PgSslMode = "disable" | "require";

export type PgPoolEnv = Readonly<Record<string, string | undefined>>;

export type PgPoolFromEnvOptions = {
  prefix?: string;
};

export function createPgPoolFromEnv(
  env: PgPoolEnv,
  options: PgPoolFromEnvOptions = {}
): Pool {
  const prefix = options.prefix ?? "SEARCHLINT_POSTGRES";
  const connectionString = requiredEnv(env, `${prefix}_DATABASE_URL`);
  const max = optionalPositiveInteger(env, `${prefix}_POOL_MAX`);
  const idleTimeoutMillis = optionalPositiveInteger(
    env,
    `${prefix}_IDLE_TIMEOUT_MS`
  );
  const connectionTimeoutMillis = optionalPositiveInteger(
    env,
    `${prefix}_CONNECTION_TIMEOUT_MS`
  );
  const ssl = sslConfig(optionalEnv(env, `${prefix}_SSL_MODE`));

  return new Pool({
    connectionString,
    ...(max === undefined ? {} : { max }),
    ...(idleTimeoutMillis === undefined ? {} : { idleTimeoutMillis }),
    ...(connectionTimeoutMillis === undefined
      ? {}
      : { connectionTimeoutMillis }),
    ...(ssl === undefined ? {} : { ssl })
  });
}

function requiredEnv(env: PgPoolEnv, name: string): string {
  const value = optionalEnv(env, name);
  if (value === undefined) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function optionalEnv(env: PgPoolEnv, name: string): string | undefined {
  const value = env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function optionalPositiveInteger(
  env: PgPoolEnv,
  name: string
): number | undefined {
  const value = optionalEnv(env, name);
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function sslConfig(
  value: string | undefined
): { rejectUnauthorized: true } | undefined {
  if (value === undefined || value === "disable") {
    return undefined;
  }
  if (value === "require") {
    return { rejectUnauthorized: true };
  }
  throw new Error("SEARCHLINT_POSTGRES_SSL_MODE must be disable or require.");
}
