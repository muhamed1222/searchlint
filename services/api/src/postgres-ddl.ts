import type {
  PersistenceColumn,
  PersistenceColumnType,
  PersistenceTableContract
} from "./schema-contracts.js";
import {
  cloudPersistenceSchema,
  persistenceColumnNames
} from "./schema-contracts.js";

export type PersistenceSchemaValidationIssue = {
  table: string;
  message: string;
};

export function validatePersistenceSchema(
  schema: readonly PersistenceTableContract[] = cloudPersistenceSchema
): readonly PersistenceSchemaValidationIssue[] {
  const issues: PersistenceSchemaValidationIssue[] = [];

  for (const table of schema) {
    const columns = new Set(persistenceColumnNames(table));
    if (!columns.has("schema_version")) {
      issues.push({
        table: table.name,
        message: "missing schema_version column"
      });
    }
    if (!columns.has("retention_until")) {
      issues.push({
        table: table.name,
        message: "missing retention_until column"
      });
    }
    if (!columns.has("deletion_state")) {
      issues.push({
        table: table.name,
        message: "missing deletion_state column"
      });
    }
    if (table.tenantScoped && !columns.has("organization_id")) {
      issues.push({
        table: table.name,
        message: "tenant-scoped table missing organization_id column"
      });
    }
    for (const index of table.indexes) {
      for (const column of index.columns) {
        if (!columns.has(column)) {
          issues.push({
            table: table.name,
            message: `index ${index.name} references missing column ${column}`
          });
        }
      }
    }
  }

  return issues;
}

export function createPostgresSchemaSql(
  schema: readonly PersistenceTableContract[] = cloudPersistenceSchema
): string {
  const issues = validatePersistenceSchema(schema);
  if (issues.length > 0) {
    throw new Error(
      `Invalid persistence schema:\n${issues
        .map((issue) => `${issue.table}: ${issue.message}`)
        .join("\n")}`
    );
  }

  return `${schema.flatMap((table) => [tableSql(table), ...indexSql(table)]).join("\n\n")}\n`;
}

function tableSql(table: PersistenceTableContract): string {
  const primaryKeys = table.columns
    .filter((column) => column.primaryKey === true)
    .map((column) => column.name);
  const lines = table.columns.map((column) => `  ${columnSql(column)}`);

  if (primaryKeys.length > 0) {
    lines.push(`  PRIMARY KEY (${primaryKeys.map(identifier).join(", ")})`);
  }

  for (const column of table.columns) {
    if (column.references) {
      const [targetTable, targetColumn] = column.references.split(".");
      if (!targetTable || !targetColumn) {
        throw new Error(
          `${table.name}.${column.name} has invalid reference ${column.references}`
        );
      }
      lines.push(
        `  FOREIGN KEY (${identifier(column.name)}) REFERENCES ${identifier(targetTable)} (${identifier(targetColumn)})`
      );
    }
  }

  return `CREATE TABLE IF NOT EXISTS ${identifier(table.name)} (\n${lines.join(",\n")}\n);`;
}

function columnSql(column: PersistenceColumn): string {
  return `${identifier(column.name)} ${postgresType(column.type)}${column.nullable ? "" : " NOT NULL"}`;
}

function indexSql(table: PersistenceTableContract): readonly string[] {
  return table.indexes.map((index) => {
    const unique = index.unique === true ? "UNIQUE " : "";
    return `CREATE ${unique}INDEX IF NOT EXISTS ${identifier(index.name)} ON ${identifier(table.name)} (${index.columns.map(identifier).join(", ")});`;
  });
}

function postgresType(type: PersistenceColumnType): string {
  if (type === "text") {
    return "TEXT";
  }
  if (type === "integer") {
    return "INTEGER";
  }
  if (type === "timestamp") {
    return "TIMESTAMPTZ";
  }
  if (type === "json") {
    return "JSONB";
  }
  return "BOOLEAN";
}

function identifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
