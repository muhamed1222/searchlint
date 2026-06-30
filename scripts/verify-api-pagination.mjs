#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { format } from "prettier";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const reportPath = path.join(repoRoot, "reports/api-pagination-report.json");
const samplePath = path.join(
  repoRoot,
  "docs/examples/api-pagination-report.sample.json"
);
const openApiPath = "specs/openapi/searchlint-cloud-api-v1.openapi.json";
const generatedAt = "2026-06-22T00:00:00.000Z";

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    stdio: options.stdio ?? "pipe"
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function caseResult(id, status, evidence, notes = []) {
  return { id, status, evidence, notes };
}

async function main() {
  run(
    "pnpm",
    ["--filter", "@searchlint/api", "test", "--", "pagination.test.ts"],
    {
      stdio: "inherit"
    }
  );
  run("pnpm", ["--filter", "@searchlint/api", "build"], {
    stdio: "inherit"
  });

  const api = await import("../services/api/dist/src/index.js");
  const cases = [];
  const options = {
    defaultPageSize: 25,
    maxPageSize: 100,
    sort: "created_at,id"
  };
  const cursor = api.encodeApiPaginationCursor({
    schemaVersion: 1,
    direction: "forward",
    sort: options.sort,
    after: "2026-06-22T00:00:00.000Z/org-1"
  });
  const parsed = api.parseApiPagination({ first: 25, after: cursor }, options);
  assert(parsed.first === 25, "Parsed page size must be 25.");
  assert(parsed.after?.after.endsWith("/org-1"), "Cursor after value drifted.");
  cases.push(
    caseResult("pagination-request-contract", "PASS", {
      defaultPageSize: options.defaultPageSize,
      maxPageSize: options.maxPageSize,
      sort: options.sort,
      parsed
    })
  );

  for (const invalid of [
    () => api.parseApiPagination({ first: 0 }, options),
    () => api.parseApiPagination({ first: 101 }, options),
    () => api.parseApiPagination({ after: "not-base64" }, options)
  ]) {
    let rejected = false;
    try {
      invalid();
    } catch {
      rejected = true;
    }
    assert(rejected, "Invalid pagination input must be rejected.");
  }
  cases.push(
    caseResult("pagination-invalid-inputs", "PASS", {
      rejectedCases: ["first=0", "first=101", "after=not-base64"]
    })
  );

  const page = api.createApiPage(
    [
      { id: "one", createdAt: "2026-06-22T00:00:00.000Z" },
      { id: "two", createdAt: "2026-06-22T00:00:01.000Z" },
      { id: "three", createdAt: "2026-06-22T00:00:02.000Z" }
    ],
    {
      requestedFirst: 2,
      sort: options.sort,
      cursorFor(item) {
        return `${item.createdAt}/${item.id}`;
      }
    }
  );
  assert(page.items.length === 2, "Page must return requested item count.");
  assert(page.pageInfo.hasNextPage === true, "Page must report next page.");
  assert(page.pageInfo.endCursor, "Page must include endCursor.");
  cases.push(
    caseResult("pagination-page-response", "PASS", {
      itemCount: page.items.length,
      pageInfo: page.pageInfo
    })
  );

  const openApi = JSON.parse(
    await readFile(path.join(repoRoot, openApiPath), "utf8")
  );
  assert(
    openApi.components?.parameters?.PaginationFirst?.schema?.maximum === 100,
    "OpenAPI PaginationFirst parameter must be reusable and bounded."
  );
  assert(
    openApi.components?.parameters?.PaginationAfter?.schema?.minLength === 1,
    "OpenAPI PaginationAfter parameter must reject empty cursors."
  );
  assert(
    openApi.components?.schemas?.PageInfo?.required?.includes("hasNextPage"),
    "OpenAPI PageInfo schema must require hasNextPage."
  );
  cases.push(
    caseResult("openapi-pagination-components", "PASS", {
      spec: openApiPath,
      parameters: ["PaginationFirst", "PaginationAfter"],
      schema: "PageInfo"
    })
  );

  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-api-pagination-verifier",
    generatedAt,
    status: "passed",
    scope: {
      proofType: "deterministic API pagination contract",
      liveDatabaseAccess: "not used by verifier",
      doesNotClaim: [
        "new list endpoint implementation",
        "real PostgreSQL pagination performance",
        "deployed API pagination behavior"
      ]
    },
    summary: {
      caseCount: cases.length,
      passed: cases.length,
      failed: 0
    },
    cases,
    remainingLiveGates: [
      "Apply pagination contract to future stable list endpoints.",
      "Run deployed API pagination acceptance against production API.",
      "Run PostgreSQL query-plan review for high-volume list endpoints."
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  console.log(
    `API pagination ${report.status.toUpperCase()}: ${report.summary.passed}/${report.summary.caseCount} cases passed`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

async function writeJson(filePath, data) {
  await writeFile(
    filePath,
    await format(JSON.stringify(data), { parser: "json" })
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
