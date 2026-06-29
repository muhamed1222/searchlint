import type { QueryResult, QueryResultRow } from "pg";
import { createHash } from "node:crypto";

import type {
  AuditLog,
  CloudTransactionManager,
  MetricsStore,
  OutboxStore,
  RelationalStore,
  UsageMeter
} from "./ports.js";
import { createPostgresDiagnosticStore } from "./postgres-diagnostic-store.js";
import { createPostgresOAuthConnectionStore } from "./postgres-oauth-connection-store.js";
import { createPostgresOutboxStore } from "./postgres-outbox-store.js";
import {
  createPostgresRelationalStore,
  type PostgresQueryExecutor,
  type PostgresQueryResult
} from "./postgres-relational-store.js";
import {
  insertAuditEventSql,
  insertMetricEventSql,
  recordUsageEventSql,
  type PostgresQuery
} from "./postgres-repository-sql.js";

export type PgQueryClient = {
  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<Row>>;
};

export type PgTransactionClient = PgQueryClient & {
  release(): void;
};

export type PgPool = PgQueryClient & {
  connect(): Promise<PgTransactionClient>;
};

export type PgCloudTransactionManagerOptions = {
  pool: PgPool;
  outbox?: boolean;
  oauthConnections?: boolean;
  queryMonitor?: PostgresQueryMonitor;
};

export type PostgresQueryObservation = {
  fingerprint: string;
  statementType: string;
  durationMs: number;
  rowCount: number;
  slow: boolean;
  status: "ok" | "error";
  errorName?: string;
};

export type PostgresQueryMonitor = {
  slowQueryThresholdMs: number;
  now?: () => number;
  observe(observation: PostgresQueryObservation): void | Promise<void>;
  observeError?(error: unknown): void | Promise<void>;
};

export function createPgQueryExecutor(
  client: PgQueryClient
): PostgresQueryExecutor {
  return {
    async query<Row extends Record<string, unknown>>(
      query: PostgresQuery
    ): Promise<PostgresQueryResult<Row>> {
      const result = await client.query<Row>(query.text, query.values);
      return {
        rows: result.rows
      };
    }
  };
}

export function createMonitoredPostgresQueryExecutor(
  executor: PostgresQueryExecutor,
  monitor: PostgresQueryMonitor
): PostgresQueryExecutor {
  const now = monitor.now ?? Date.now;
  return {
    async query<Row extends Record<string, unknown>>(
      query: PostgresQuery
    ): Promise<PostgresQueryResult<Row>> {
      const startedAt = now();
      try {
        const result = await executor.query<Row>(query);
        const durationMs = Math.max(0, now() - startedAt);
        await recordQueryObservation(monitor, {
          fingerprint: fingerprintQueryText(query.text),
          statementType: statementType(query.text),
          durationMs,
          rowCount: result.rows.length,
          slow: durationMs >= monitor.slowQueryThresholdMs,
          status: "ok"
        });
        return result;
      } catch (error) {
        const durationMs = Math.max(0, now() - startedAt);
        await recordQueryObservation(monitor, {
          fingerprint: fingerprintQueryText(query.text),
          statementType: statementType(query.text),
          durationMs,
          rowCount: 0,
          slow: durationMs >= monitor.slowQueryThresholdMs,
          status: "error",
          errorName: error instanceof Error ? error.name : "UnknownError"
        });
        throw error;
      }
    }
  };
}

export function createPgCloudTransactionManager(
  options: PgCloudTransactionManagerOptions
): CloudTransactionManager {
  return {
    async transaction(operation) {
      const client = await options.pool.connect();
      const baseExecutor = createPgQueryExecutor(client);
      const executor =
        options.queryMonitor === undefined
          ? baseExecutor
          : createMonitoredPostgresQueryExecutor(
              baseExecutor,
              options.queryMonitor
            );
      try {
        await client.query("BEGIN");
        const result = await operation({
          store: createPostgresRelationalStore(executor),
          auditLog: createPostgresAuditLog(executor),
          metrics: createPostgresMetricsStore(executor),
          diagnostics: createPostgresDiagnosticStore(executor),
          usageMeter: createPostgresUsageMeter(executor),
          ...(options.oauthConnections
            ? { oauthConnections: createPostgresOAuthConnectionStore(executor) }
            : {}),
          ...(options.outbox
            ? { outbox: createPostgresOutboxStore(executor) }
            : {})
        });
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
  };
}

function fingerprintQueryText(text: string): string {
  return createHash("sha256").update(normalizeQueryText(text)).digest("hex");
}

function normalizeQueryText(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function statementType(text: string): string {
  return normalizeQueryText(text).split(/\s+/u)[0]?.toUpperCase() ?? "UNKNOWN";
}

async function recordQueryObservation(
  monitor: PostgresQueryMonitor,
  observation: PostgresQueryObservation
): Promise<void> {
  try {
    await monitor.observe(observation);
  } catch (error) {
    await monitor.observeError?.(error);
  }
}

export function createPostgresAuditLog(
  executor: PostgresQueryExecutor
): AuditLog {
  return {
    async append(event) {
      await executor.query(insertAuditEventSql(event));
    }
  };
}

export function createPostgresMetricsStore(
  executor: PostgresQueryExecutor
): MetricsStore {
  return {
    async record(event) {
      await executor.query(insertMetricEventSql(event));
    }
  };
}

export function createPostgresUsageMeter(
  executor: PostgresQueryExecutor
): UsageMeter {
  return {
    async record(event) {
      await executor.query(recordUsageEventSql(event));
    }
  };
}
