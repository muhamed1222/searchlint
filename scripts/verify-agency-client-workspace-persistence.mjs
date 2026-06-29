#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { format } from "prettier";

const reportPath = "reports/agency-client-workspace-persistence-report.json";
const samplePath =
  "docs/examples/agency-client-workspace-persistence-report.sample.json";

const commands = [
  {
    name: "apiAgencyPersistenceTests",
    command: "pnpm",
    args: [
      "--filter",
      "@searchlint/api",
      "test",
      "--",
      "contracts.test.ts",
      "postgres-ddl.test.ts",
      "postgres-agency-client-workspace-store.test.ts"
    ]
  },
  {
    name: "agencyPersistencePacket",
    command: "pnpm",
    args: ["agency:persistence-acceptance-packet"]
  },
  {
    name: "apiBuild",
    command: "pnpm",
    args: ["--filter", "@searchlint/api", "build"]
  }
];

async function main() {
  const commandResults = commands.map(runCommand);
  const api = await import(
    pathToFileURL(path.resolve("services/api/dist/src/index.js")).href
  );

  const schemaCase = verifySchema(api);
  const sqlCase = verifySql(api);
  const storeCase = await verifyStore(api);
  const ddlCase = verifyDdl(api);

  const report = {
    generatedBy: "searchlint-agency-client-workspace-persistence-verifier",
    generatedAt: "2026-06-23T00:00:00.000Z",
    status: "passed",
    scope: {
      proofType:
        "deterministic agency client workspace production persistence contract and store proof",
      doesNotClaim: [
        "deployed RDS connectivity",
        "owner-provided deployed agency persistence evidence",
        "client portal deployment",
        "live agency billing",
        "hosted white-label report links",
        "brand asset upload or custom domains"
      ]
    },
    commands: commandResults,
    cases: {
      schema: schemaCase,
      sql: sqlCase,
      store: storeCase,
      ddl: ddlCase
    },
    remainingReleaseGates: [
      "Capture owner-provided deployed RDS/API evidence for agency persistence.",
      "Deploy client portal and run client-access browser E2E.",
      "Implement live agency billing.",
      "Implement hosted white-label report links.",
      "Implement brand asset upload or custom domains if required."
    ]
  };

  assertNoForbiddenSecrets(report);
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    "Agency client workspace persistence PASS: schema, SQL, store, and DDL verified"
  );
  console.log(`Report: ${reportPath}`);
  console.log(`Sample: ${samplePath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

function verifySchema(api) {
  const tableNames = [
    "agency_client_workspaces",
    "agency_shared_rule_policies",
    "agency_client_projects",
    "agency_white_label_brands"
  ];
  const tables = tableNames.map((name) => api.persistenceTable(name));
  for (const table of tables) {
    assert(table, "agency persistence table must exist.");
    assert(table.tenantScoped === true, `${table.name} must be tenant scoped.`);
    assert(
      table.retentionClass === "diagnostic_summary",
      `${table.name} must use diagnostic_summary retention.`
    );
  }
  return {
    tables: tables.map((table) => table.name),
    schemaVersions: tables.map((table) => table.schemaVersion),
    retentionClasses: tables.map((table) => table.retentionClass)
  };
}

function verifySql(api) {
  const workspaceQuery = api.upsertAgencyClientWorkspaceSql(workspaceInput());
  const projectQuery = api.upsertAgencyClientProjectSql(projectInput());
  const policyQuery = api.upsertAgencySharedRulePolicySql(policyInput());
  const brandQuery = api.upsertAgencyWhiteLabelBrandSql(brandInput());

  assert(
    workspaceQuery.text.includes('INSERT INTO "agency_client_workspaces"'),
    "workspace SQL must insert agency_client_workspaces."
  );
  assert(
    projectQuery.text.includes(
      'ON CONFLICT ("organization_id", "workspace_id", "project_id") DO UPDATE'
    ),
    "project SQL must upsert by organization/workspace/project."
  );
  assert(
    policyQuery.values[2] === "cloud.agency_shared_rule_policies.v1",
    "policy SQL must use policy schema version."
  );
  assert(
    brandQuery.text.includes(
      'ON CONFLICT ("organization_id", "workspace_id") DO UPDATE'
    ),
    "brand SQL must upsert one brand per workspace."
  );

  return {
    tables: [
      "agency_client_workspaces",
      "agency_client_projects",
      "agency_shared_rule_policies",
      "agency_white_label_brands"
    ],
    workspaceValueCount: workspaceQuery.values.length,
    projectValueCount: projectQuery.values.length,
    policyValueCount: policyQuery.values.length,
    brandValueCount: brandQuery.values.length
  };
}

async function verifyStore(api) {
  const rows = [
    workspaceRow(workspaceInput()),
    projectRow(projectInput()),
    policyRow(policyInput()),
    brandRow(brandInput())
  ];
  const executor = {
    queries: [],
    async query(query) {
      this.queries.push(query);
      const row = rows.shift();
      return { rows: row ? [row] : [] };
    }
  };
  const store = api.createPostgresAgencyClientWorkspaceStore(executor);
  const workspace = await store.upsertWorkspace(workspaceInput());
  const project = await store.upsertClientProject(projectInput());
  const policy = await store.upsertSharedRulePolicy(policyInput());
  const brand = await store.upsertWhiteLabelBrand(brandInput());

  expectEqual(workspace.clientName, "Acme Retail");
  expectEqual(project.sharedPolicyId, "policy-a");
  expectEqual(policy.ruleIds, ["SL-META-001", "SL-CANON-001"]);
  expectEqual(brand.brandLabel, "Acme SEO");

  return {
    queryCount: executor.queries.length,
    workspaceId: workspace.id,
    projectId: project.projectId,
    policyId: policy.id,
    brandWorkspaceId: brand.clientWorkspaceId
  };
}

function verifyDdl(api) {
  const ddl = api.createPostgresSchemaSql();
  for (const table of [
    "agency_client_workspaces",
    "agency_client_projects",
    "agency_shared_rule_policies",
    "agency_white_label_brands"
  ]) {
    assert(
      ddl.includes(`CREATE TABLE IF NOT EXISTS "${table}"`),
      `DDL must create ${table}.`
    );
  }
  assert(
    ddl.includes(
      'CREATE UNIQUE INDEX IF NOT EXISTS "agency_client_projects_project_unique_idx"'
    ),
    "DDL must create agency client project unique index."
  );
  return {
    hasTables: true,
    hasProjectUniqueIndex: true,
    hasBrandUniqueIndex: ddl.includes(
      'CREATE UNIQUE INDEX IF NOT EXISTS "agency_white_label_brands_workspace_unique_idx"'
    )
  };
}

function workspaceInput() {
  return {
    id: "client-a",
    organizationId: "org-1",
    clientName: "Acme Retail",
    status: "active",
    ownerPrincipalId: "principal-owner",
    createdAt: "2026-06-23T12:20:00.000Z"
  };
}

function projectInput() {
  return {
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
    createdAt: "2026-06-23T12:20:00.000Z"
  };
}

function policyInput() {
  return {
    id: "policy-a",
    organizationId: "org-1",
    name: "Agency baseline",
    ruleIds: ["SL-META-001", "SL-CANON-001"],
    severityOverrides: {
      "SL-META-001": "error"
    },
    createdAt: "2026-06-23T12:20:00.000Z"
  };
}

function brandInput() {
  return {
    id: "brand-a",
    organizationId: "org-1",
    clientWorkspaceId: "client-a",
    brandLabel: "Acme SEO",
    logoUri: "s3://searchlint-artifacts/org-1/brands/acme.svg",
    primaryColor: "#0f766e",
    reportFooter: "Prepared for Acme Retail",
    createdAt: "2026-06-23T12:20:00.000Z"
  };
}

function workspaceRow(record) {
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

function projectRow(record) {
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
    last_crawl_at: record.lastCrawlAt,
    assignee_principal_id: record.assigneePrincipalId,
    shared_policy_id: record.sharedPolicyId,
    sla_due_at: record.slaDueAt
  };
}

function policyRow(record) {
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

function brandRow(record) {
  return {
    id: record.id,
    organization_id: record.organizationId,
    schema_version: "cloud.agency_white_label_brands.v1",
    created_at: record.createdAt,
    retention_until: null,
    deletion_state: "active",
    workspace_id: record.clientWorkspaceId,
    brand_label: record.brandLabel,
    logo_uri: record.logoUri,
    primary_color: record.primaryColor,
    report_footer: record.reportFooter
  };
}

function runCommand(command) {
  const result = spawnSync(command.command, command.args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) {
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`${command.name} failed with exit code ${result.status}.`);
  }
  return {
    name: command.name,
    command: [command.command, ...command.args].join(" "),
    status: "passed"
  };
}

async function writeJson(filePath, value) {
  const formatted = await format(JSON.stringify(value), { parser: "json" });
  await writeFile(filePath, formatted);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function expectEqual(actual, expected) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  assert(
    actualJson === expectedJson,
    `Expected ${expectedJson}, received ${actualJson}.`
  );
}

function assertNoForbiddenSecrets(value) {
  const text = JSON.stringify(value).toLowerCase();
  for (const forbidden of [
    "customer@example.com",
    "-----begin private key",
    "private_key=",
    "postgres://",
    "postgresql://",
    "password=",
    "authorization: bearer",
    "bearer sk_",
    "raw_brand_asset",
    "cross_tenant_payload",
    "invite_token="
  ]) {
    if (text.includes(forbidden)) {
      throw new Error(`Forbidden secret-like value found: ${forbidden}`);
    }
  }
}
