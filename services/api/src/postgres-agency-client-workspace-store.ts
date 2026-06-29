import type {
  AgencyClientProject,
  AgencyClientWorkspace,
  AgencySharedRulePolicy,
  AgencyWhiteLabelBrand
} from "./agency-mode.js";
import type { PostgresQueryExecutor } from "./postgres-relational-store.js";
import {
  selectAgencyClientProjectsSql,
  selectAgencyClientWorkspacesSql,
  selectAgencySharedRulePoliciesSql,
  selectAgencyWhiteLabelBrandsSql,
  upsertAgencyClientProjectSql,
  upsertAgencyClientWorkspaceSql,
  upsertAgencySharedRulePolicySql,
  upsertAgencyWhiteLabelBrandSql
} from "./postgres-repository-sql.js";

export type AgencyClientWorkspaceStore = {
  upsertWorkspace(input: AgencyClientWorkspace): Promise<AgencyClientWorkspace>;
  listWorkspaces(input: {
    organizationId: string;
    limit: number;
  }): Promise<readonly AgencyClientWorkspace[]>;
  upsertClientProject(
    input: AgencyClientProject & {
      organizationId: string;
      createdAt: string;
    }
  ): Promise<AgencyClientProject>;
  listClientProjects(input: {
    organizationId: string;
    workspaceId: string;
    limit: number;
  }): Promise<readonly AgencyClientProject[]>;
  upsertSharedRulePolicy(
    input: AgencySharedRulePolicy & { createdAt: string }
  ): Promise<AgencySharedRulePolicy>;
  listSharedRulePolicies(input: {
    organizationId: string;
    limit: number;
  }): Promise<readonly AgencySharedRulePolicy[]>;
  upsertWhiteLabelBrand(
    input: AgencyWhiteLabelBrand & {
      id: string;
      organizationId: string;
      createdAt: string;
    }
  ): Promise<AgencyWhiteLabelBrand>;
  listWhiteLabelBrands(input: {
    organizationId: string;
    limit: number;
  }): Promise<readonly AgencyWhiteLabelBrand[]>;
};

export function createPostgresAgencyClientWorkspaceStore(
  executor: PostgresQueryExecutor
): AgencyClientWorkspaceStore {
  return {
    async upsertWorkspace(input) {
      const row = await requiredRow(
        executor.query(upsertAgencyClientWorkspaceSql(input)),
        "upsertWorkspace"
      );
      return workspaceFromRow(row);
    },
    async listWorkspaces(input) {
      const result = await executor.query<Record<string, unknown>>(
        selectAgencyClientWorkspacesSql(input)
      );
      return result.rows.map(workspaceFromRow);
    },
    async upsertClientProject(input) {
      const row = await requiredRow(
        executor.query(upsertAgencyClientProjectSql(input)),
        "upsertClientProject"
      );
      return clientProjectFromRow(row);
    },
    async listClientProjects(input) {
      const result = await executor.query<Record<string, unknown>>(
        selectAgencyClientProjectsSql(input)
      );
      return result.rows.map(clientProjectFromRow);
    },
    async upsertSharedRulePolicy(input) {
      const row = await requiredRow(
        executor.query(upsertAgencySharedRulePolicySql(input)),
        "upsertSharedRulePolicy"
      );
      return sharedPolicyFromRow(row);
    },
    async listSharedRulePolicies(input) {
      const result = await executor.query<Record<string, unknown>>(
        selectAgencySharedRulePoliciesSql(input)
      );
      return result.rows.map(sharedPolicyFromRow);
    },
    async upsertWhiteLabelBrand(input) {
      const row = await requiredRow(
        executor.query(upsertAgencyWhiteLabelBrandSql(input)),
        "upsertWhiteLabelBrand"
      );
      return whiteLabelBrandFromRow(row);
    },
    async listWhiteLabelBrands(input) {
      const result = await executor.query<Record<string, unknown>>(
        selectAgencyWhiteLabelBrandsSql(input)
      );
      return result.rows.map(whiteLabelBrandFromRow);
    }
  };
}

async function requiredRow(
  result: Promise<{ rows: readonly Record<string, unknown>[] }>,
  operation: string
): Promise<Record<string, unknown>> {
  const row = (await result).rows[0];
  if (!row) {
    throw new Error(`${operation} did not return a row.`);
  }
  return row;
}

function workspaceFromRow(row: Record<string, unknown>): AgencyClientWorkspace {
  return {
    id: text(row, "id"),
    organizationId: text(row, "organization_id"),
    clientName: text(row, "client_name"),
    status: workspaceStatus(row.status),
    ownerPrincipalId: text(row, "owner_principal_id"),
    createdAt: text(row, "created_at")
  };
}

function clientProjectFromRow(
  row: Record<string, unknown>
): AgencyClientProject {
  const project: AgencyClientProject = {
    id: text(row, "id"),
    workspaceId: text(row, "workspace_id"),
    projectId: text(row, "project_id"),
    environmentId: text(row, "environment_id"),
    displayName: text(row, "display_name"),
    siteUrl: text(row, "site_url"),
    healthScore: integer(row, "health_score"),
    openDiagnostics: integer(row, "open_diagnostics"),
    blockerDiagnostics: integer(row, "blocker_diagnostics")
  };
  const lastCrawlAt = optionalText(row, "last_crawl_at");
  if (lastCrawlAt !== undefined) {
    project.lastCrawlAt = lastCrawlAt;
  }
  const assigneePrincipalId = optionalText(row, "assignee_principal_id");
  if (assigneePrincipalId !== undefined) {
    project.assigneePrincipalId = assigneePrincipalId;
  }
  const sharedPolicyId = optionalText(row, "shared_policy_id");
  if (sharedPolicyId !== undefined) {
    project.sharedPolicyId = sharedPolicyId;
  }
  const slaDueAt = optionalText(row, "sla_due_at");
  if (slaDueAt !== undefined) {
    project.slaDueAt = slaDueAt;
  }
  return project;
}

function sharedPolicyFromRow(
  row: Record<string, unknown>
): AgencySharedRulePolicy {
  return {
    id: text(row, "id"),
    organizationId: text(row, "organization_id"),
    name: text(row, "name"),
    ruleIds: stringArray(row.rule_ids, "rule_ids"),
    severityOverrides: severityOverrides(row.severity_overrides)
  };
}

function whiteLabelBrandFromRow(
  row: Record<string, unknown>
): AgencyWhiteLabelBrand {
  const brand: AgencyWhiteLabelBrand = {
    clientWorkspaceId: text(row, "workspace_id"),
    brandLabel: text(row, "brand_label")
  };
  const logoUri = optionalText(row, "logo_uri");
  if (logoUri !== undefined) {
    brand.logoUri = logoUri;
  }
  const primaryColor = optionalText(row, "primary_color");
  if (primaryColor !== undefined) {
    brand.primaryColor = primaryColor;
  }
  const reportFooter = optionalText(row, "report_footer");
  if (reportFooter !== undefined) {
    brand.reportFooter = reportFooter;
  }
  return brand;
}

function text(row: Record<string, unknown>, field: string): string {
  const value = row[field];
  if (typeof value !== "string") {
    throw new Error(`Expected ${field} to be a string.`);
  }
  return value;
}

function optionalText(
  row: Record<string, unknown>,
  field: string
): string | undefined {
  const value = row[field];
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`Expected ${field} to be a string when present.`);
  }
  return value;
}

function integer(row: Record<string, unknown>, field: string): number {
  const value = row[field];
  if (!Number.isInteger(value)) {
    throw new Error(`Expected ${field} to be an integer.`);
  }
  return value as number;
}

function workspaceStatus(value: unknown): AgencyClientWorkspace["status"] {
  if (value === "active" || value === "paused" || value === "archived") {
    return value;
  }
  throw new Error("Expected status to be an agency client workspace status.");
}

function stringArray(value: unknown, field: string): readonly string[] {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    throw new Error(`Expected ${field} to be a string array.`);
  }
  return value;
}

function severityOverrides(
  value: unknown
): AgencySharedRulePolicy["severityOverrides"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected severity_overrides to be a JSON object.");
  }
  for (const severity of Object.values(value)) {
    if (
      severity !== "blocker" &&
      severity !== "error" &&
      severity !== "warning" &&
      severity !== "info"
    ) {
      throw new Error("Expected severity override values to be severities.");
    }
  }
  return value as AgencySharedRulePolicy["severityOverrides"];
}
