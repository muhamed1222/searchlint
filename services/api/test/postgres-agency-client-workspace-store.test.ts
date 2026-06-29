import { describe, expect, it } from "vitest";

import { createPostgresAgencyClientWorkspaceStore } from "../src/index.js";
import type {
  AgencyClientProject,
  AgencyClientWorkspace,
  AgencySharedRulePolicy,
  AgencyWhiteLabelBrand,
  PostgresQuery,
  PostgresQueryExecutor,
  PostgresQueryResult
} from "../src/index.js";

const createdAt = "2026-06-23T12:20:00.000Z";

const workspace: AgencyClientWorkspace = {
  id: "client-a",
  organizationId: "org-1",
  clientName: "Acme Retail",
  status: "active",
  ownerPrincipalId: "principal-owner",
  createdAt
};

const project: AgencyClientProject & {
  organizationId: string;
  createdAt: string;
} = {
  id: "client-project-a",
  organizationId: "org-1",
  workspaceId: "client-a",
  projectId: "project-a",
  environmentId: "env-a",
  displayName: "Acme Store",
  siteUrl: "https://acme.test",
  healthScore: 92,
  openDiagnostics: 12,
  blockerDiagnostics: 1,
  lastCrawlAt: "2026-06-23T12:00:00.000Z",
  assigneePrincipalId: "principal-analyst",
  sharedPolicyId: "policy-a",
  slaDueAt: "2026-06-24T00:00:00.000Z",
  createdAt
};

const policy: AgencySharedRulePolicy & { createdAt: string } = {
  id: "policy-a",
  organizationId: "org-1",
  name: "Agency baseline",
  ruleIds: ["SL-META-001", "SL-CANON-001"],
  severityOverrides: {
    "SL-META-001": "error"
  },
  createdAt
};

const brand: AgencyWhiteLabelBrand & {
  id: string;
  organizationId: string;
  createdAt: string;
} = {
  id: "brand-a",
  organizationId: "org-1",
  clientWorkspaceId: "client-a",
  brandLabel: "Acme SEO",
  logoUri: "s3://searchlint-artifacts/org-1/brands/acme.svg",
  primaryColor: "#0f766e",
  reportFooter: "Prepared for Acme Retail",
  createdAt
};

describe("createPostgresAgencyClientWorkspaceStore", () => {
  it("persists agency client workspace records and related rows", async () => {
    const executor = new FakeExecutor([
      workspaceRow(workspace),
      projectRow(project),
      policyRow(policy),
      brandRow(brand)
    ]);
    const store = createPostgresAgencyClientWorkspaceStore(executor);

    await expect(store.upsertWorkspace(workspace)).resolves.toEqual(workspace);
    await expect(store.upsertClientProject(project)).resolves.toEqual({
      id: project.id,
      workspaceId: project.workspaceId,
      projectId: project.projectId,
      environmentId: project.environmentId,
      displayName: project.displayName,
      siteUrl: project.siteUrl,
      healthScore: project.healthScore,
      openDiagnostics: project.openDiagnostics,
      blockerDiagnostics: project.blockerDiagnostics,
      lastCrawlAt: project.lastCrawlAt,
      assigneePrincipalId: project.assigneePrincipalId,
      sharedPolicyId: project.sharedPolicyId,
      slaDueAt: project.slaDueAt
    });
    await expect(store.upsertSharedRulePolicy(policy)).resolves.toEqual({
      id: policy.id,
      organizationId: policy.organizationId,
      name: policy.name,
      ruleIds: policy.ruleIds,
      severityOverrides: policy.severityOverrides
    });
    await expect(store.upsertWhiteLabelBrand(brand)).resolves.toEqual({
      clientWorkspaceId: brand.clientWorkspaceId,
      brandLabel: brand.brandLabel,
      logoUri: brand.logoUri,
      primaryColor: brand.primaryColor,
      reportFooter: brand.reportFooter
    });

    expect(executor.queries.map((query) => query.text)).toEqual([
      expect.stringContaining('INSERT INTO "agency_client_workspaces"'),
      expect.stringContaining('INSERT INTO "agency_client_projects"'),
      expect.stringContaining('INSERT INTO "agency_shared_rule_policies"'),
      expect.stringContaining('INSERT INTO "agency_white_label_brands"')
    ]);
  });

  it("lists agency persistence rows in deterministic order", async () => {
    const executor = new FakeExecutor([
      workspaceRow(workspace),
      projectRow(project),
      policyRow(policy),
      brandRow(brand)
    ]);
    const store = createPostgresAgencyClientWorkspaceStore(executor);

    await expect(
      store.listWorkspaces({ organizationId: "org-1", limit: 10 })
    ).resolves.toEqual([workspace]);
    await expect(
      store.listClientProjects({
        organizationId: "org-1",
        workspaceId: "client-a",
        limit: 10
      })
    ).resolves.toHaveLength(1);
    await expect(
      store.listSharedRulePolicies({ organizationId: "org-1", limit: 10 })
    ).resolves.toHaveLength(1);
    await expect(
      store.listWhiteLabelBrands({ organizationId: "org-1", limit: 10 })
    ).resolves.toHaveLength(1);

    expect(executor.queries.map((query) => query.values.at(-1))).toEqual([
      10, 10, 10, 10
    ]);
  });

  it("fails deterministically when an upsert returns no row", async () => {
    const executor = new FakeExecutor([undefined]);
    const store = createPostgresAgencyClientWorkspaceStore(executor);

    await expect(store.upsertWorkspace(workspace)).rejects.toThrow(
      "upsertWorkspace did not return a row."
    );
  });
});

function workspaceRow(record: AgencyClientWorkspace): Record<string, unknown> {
  return {
    id: record.id,
    organization_id: record.organizationId,
    schema_version: "cloud.agency_client_workspaces.v1",
    created_at: record.createdAt,
    retention_until: null,
    deletion_state: "active",
    client_name: record.clientName,
    status: record.status,
    owner_principal_id: record.ownerPrincipalId
  };
}

function projectRow(
  record: AgencyClientProject & { organizationId: string; createdAt: string }
): Record<string, unknown> {
  return {
    id: record.id,
    organization_id: record.organizationId,
    schema_version: "cloud.agency_client_projects.v1",
    created_at: record.createdAt,
    retention_until: null,
    deletion_state: "active",
    workspace_id: record.workspaceId,
    project_id: record.projectId,
    environment_id: record.environmentId,
    display_name: record.displayName,
    site_url: record.siteUrl,
    health_score: record.healthScore,
    open_diagnostics: record.openDiagnostics,
    blocker_diagnostics: record.blockerDiagnostics,
    last_crawl_at: record.lastCrawlAt ?? null,
    assignee_principal_id: record.assigneePrincipalId ?? null,
    shared_policy_id: record.sharedPolicyId ?? null,
    sla_due_at: record.slaDueAt ?? null
  };
}

function policyRow(
  record: AgencySharedRulePolicy & { createdAt: string }
): Record<string, unknown> {
  return {
    id: record.id,
    organization_id: record.organizationId,
    schema_version: "cloud.agency_shared_rule_policies.v1",
    created_at: record.createdAt,
    retention_until: null,
    deletion_state: "active",
    name: record.name,
    rule_ids: record.ruleIds,
    severity_overrides: record.severityOverrides
  };
}

function brandRow(
  record: AgencyWhiteLabelBrand & {
    id: string;
    organizationId: string;
    createdAt: string;
  }
): Record<string, unknown> {
  return {
    id: record.id,
    organization_id: record.organizationId,
    schema_version: "cloud.agency_white_label_brands.v1",
    created_at: record.createdAt,
    retention_until: null,
    deletion_state: "active",
    workspace_id: record.clientWorkspaceId,
    brand_label: record.brandLabel,
    logo_uri: record.logoUri ?? null,
    primary_color: record.primaryColor ?? null,
    report_footer: record.reportFooter ?? null
  };
}

type FakeRow = Record<string, unknown> | undefined;

class FakeExecutor implements PostgresQueryExecutor {
  readonly queries: PostgresQuery[] = [];
  private readonly rows: FakeRow[];

  constructor(rows: readonly FakeRow[]) {
    this.rows = [...rows];
  }

  async query<Row extends Record<string, unknown>>(
    query: PostgresQuery
  ): Promise<PostgresQueryResult<Row>> {
    this.queries.push(query);
    const row = this.rows.shift();
    return {
      rows: row ? [row as Row] : []
    };
  }
}
