export type PostgresRecoveryMode = "backup-restore" | "point-in-time-recovery";

export type PostgresMigrationLedgerEntry = {
  id: string;
  checksum: string;
};

export type PostgresRestorePitrInput = {
  mode: PostgresRecoveryMode;
  sourceEnvironment: string;
  isolatedTargetEnvironment: string;
  requestedAt: string;
  recoverySourceAt: string;
  restoreStartedAt: string;
  restoreCompletedAt: string;
  validationCompletedAt: string;
  schemaSqlSha256: string;
  migrationLedger: readonly PostgresMigrationLedgerEntry[];
  rpoTargetHours?: number;
  rtoTargetHours?: number;
};

export type PostgresRestorePitrPlan = {
  mode: PostgresRecoveryMode;
  sourceEnvironment: string;
  isolatedTargetEnvironment: string;
  recoverySourceAt: string;
  rpoHours: number;
  rtoHours: number;
  rpoTargetHours: number;
  rtoTargetHours: number;
  rpoWithinTarget: boolean;
  rtoWithinTarget: boolean;
  schemaSqlSha256: string;
  migrationLedger: readonly PostgresMigrationLedgerEntry[];
  validationSteps: readonly string[];
  remainingLiveEvidence: readonly string[];
};

const defaultRpoTargetHours = 24;
const defaultRtoTargetHours = 4;

export function createPostgresRestorePitrPlan(
  input: PostgresRestorePitrInput
): PostgresRestorePitrPlan {
  const sourceEnvironment = requiredNonEmpty(
    input.sourceEnvironment,
    "sourceEnvironment"
  );
  const isolatedTargetEnvironment = requiredNonEmpty(
    input.isolatedTargetEnvironment,
    "isolatedTargetEnvironment"
  );
  if (sourceEnvironment === isolatedTargetEnvironment) {
    throw new Error(
      "PostgreSQL restore target must be isolated from the source environment."
    );
  }

  const requestedAt = parseIsoTimestamp(input.requestedAt, "requestedAt");
  const recoverySourceAt = parseIsoTimestamp(
    input.recoverySourceAt,
    "recoverySourceAt"
  );
  const restoreStartedAt = parseIsoTimestamp(
    input.restoreStartedAt,
    "restoreStartedAt"
  );
  const restoreCompletedAt = parseIsoTimestamp(
    input.restoreCompletedAt,
    "restoreCompletedAt"
  );
  const validationCompletedAt = parseIsoTimestamp(
    input.validationCompletedAt,
    "validationCompletedAt"
  );

  if (recoverySourceAt.getTime() > requestedAt.getTime()) {
    throw new Error("PostgreSQL recovery source cannot be after requestedAt.");
  }
  if (restoreCompletedAt.getTime() < restoreStartedAt.getTime()) {
    throw new Error("PostgreSQL restore cannot complete before it starts.");
  }
  if (validationCompletedAt.getTime() < restoreCompletedAt.getTime()) {
    throw new Error(
      "PostgreSQL validation cannot complete before restore completion."
    );
  }

  const rpoTargetHours = positiveNumber(
    input.rpoTargetHours ?? defaultRpoTargetHours,
    "rpoTargetHours"
  );
  const rtoTargetHours = positiveNumber(
    input.rtoTargetHours ?? defaultRtoTargetHours,
    "rtoTargetHours"
  );
  const migrationLedger = normalizeMigrationLedger(input.migrationLedger);
  const schemaSqlSha256 = requiredSha256(
    input.schemaSqlSha256,
    "schemaSqlSha256"
  );
  const rpoHours = hoursBetween(recoverySourceAt, requestedAt);
  const rtoHours = hoursBetween(restoreStartedAt, validationCompletedAt);

  return {
    mode: input.mode,
    sourceEnvironment,
    isolatedTargetEnvironment,
    recoverySourceAt: recoverySourceAt.toISOString(),
    rpoHours,
    rtoHours,
    rpoTargetHours,
    rtoTargetHours,
    rpoWithinTarget: rpoHours <= rpoTargetHours,
    rtoWithinTarget: rtoHours <= rtoTargetHours,
    schemaSqlSha256,
    migrationLedger,
    validationSteps: [
      "restore into an isolated PostgreSQL target, never over the source database",
      "run current SearchLint migrations and verify migration ledger checksums",
      "verify restored schema checksum matches the expected cloud schema",
      "run tenant-isolation and RBAC data-layer checks against the restored target",
      "run representative API and dashboard read paths against the restored target",
      "verify deleted tenants remain excluded from active service after restore",
      "record restore start, restore completion, validation completion, RPO, and RTO"
    ],
    remainingLiveEvidence: [
      "real RDS backup restore drill",
      "real RDS point-in-time recovery drill",
      "restored database tenant/RBAC validation against deployed infrastructure",
      "recorded production RPO/RTO evidence"
    ]
  };
}

function normalizeMigrationLedger(
  ledger: readonly PostgresMigrationLedgerEntry[]
): readonly PostgresMigrationLedgerEntry[] {
  if (ledger.length === 0) {
    throw new Error("PostgreSQL migration ledger must not be empty.");
  }
  const seen = new Set<string>();
  return ledger.map((entry, index) => {
    const id = requiredNonEmpty(entry.id, `migrationLedger[${index}].id`);
    if (seen.has(id)) {
      throw new Error(`Duplicate PostgreSQL migration ledger id: ${id}.`);
    }
    seen.add(id);
    return {
      id,
      checksum: requiredSha256(
        entry.checksum,
        `migrationLedger[${index}].checksum`
      )
    };
  });
}

function requiredNonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${field} is required.`);
  }
  return trimmed;
}

function requiredSha256(value: string, field: string): string {
  const trimmed = requiredNonEmpty(value, field);
  if (!/^[a-f0-9]{64}$/u.test(trimmed)) {
    throw new Error(`${field} must be a lowercase sha256 digest.`);
  }
  return trimmed;
}

function positiveNumber(value: number, field: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be a positive number.`);
  }
  return value;
}

function parseIsoTimestamp(value: string, field: string): Date {
  const trimmed = requiredNonEmpty(value, field);
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== trimmed) {
    throw new Error(`${field} must be an ISO-8601 UTC timestamp.`);
  }
  return date;
}

function hoursBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 3_600_000;
}
