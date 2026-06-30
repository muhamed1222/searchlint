#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const reportPath = path.join(
  repoRoot,
  "reports/next-source-mapping-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/next-source-mapping-report.sample.json"
);
const fixedGeneratedAt = "2026-06-23T00:00:00.000Z";
const sourceExtensions = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs"]);

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

function findingKindCounts(findings) {
  const counts = {};
  for (const finding of findings) {
    counts[finding.kind] = (counts[finding.kind] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))
  );
}

async function main() {
  run("pnpm", ["build"], { stdio: "inherit" });

  const {
    buildNextConfigSummary,
    buildNextRouteMetadataSummaries,
    buildNextRouteModel,
    discoverNextProjectSourceFiles
  } = await import("../packages/next/dist/src/index.js");
  const { analyzeNextSourceFiles } =
    await import("../packages/source/dist/src/index.js");

  const workDir = await mkdtemp(
    path.join(tmpdir(), "searchlint-next-source-mapping-")
  );
  const report = {
    schemaVersion: 1,
    generatedAt: fixedGeneratedAt,
    nodeVersion: process.version,
    status: "PASS",
    summary: {
      projectCount: projectFixtures.length,
      caseCount: 0,
      passed: 0,
      failed: 0
    },
    projects: []
  };

  try {
    for (const project of projectFixtures) {
      const projectDir = path.join(workDir, project.id);
      await writeProject(projectDir, project.files);
      const files = await readProjectSourceFiles(projectDir);
      const source = analyzeNextSourceFiles(files);
      const sourceFiles = discoverNextProjectSourceFiles(
        files.map((file) => file.path)
      ).sourceFiles;
      const routeFindings = source.findings.filter((finding) =>
        [
          "static-metadata-object",
          "static-metadata-field",
          "generate-metadata"
        ].includes(finding.kind)
      );
      const routeModel = buildNextRouteModel(sourceFiles, routeFindings);
      const metadataSummaries = buildNextRouteMetadataSummaries(
        routeModel,
        routeFindings
      );
      const configSummary = buildNextConfigSummary(
        sourceFiles,
        source.findings.filter((finding) =>
          ["next-config-redirects", "next-config-rewrites"].includes(
            finding.kind
          )
        )
      );

      const projectResult = verifyProject({
        project,
        files,
        source,
        sourceFiles,
        routeModel,
        metadataSummaries,
        configSummary
      });
      report.projects.push(projectResult);
      report.summary.caseCount += projectResult.cases.length;
      report.summary.passed += projectResult.cases.filter(
        (item) => item.status === "PASS"
      ).length;
      report.summary.failed += projectResult.cases.filter(
        (item) => item.status !== "PASS"
      ).length;
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }

  report.status = report.summary.failed === 0 ? "PASS" : "FAIL";
  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(samplePath, `${JSON.stringify(report, null, 2)}\n`);
  run("pnpm", ["exec", "prettier", "--write", samplePath]);

  if (report.status !== "PASS") {
    process.exitCode = 1;
  }

  console.log(
    `Next source mapping ${report.status}: ${report.summary.passed}/${report.summary.caseCount} cases passed`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

async function writeProject(projectDir, files) {
  for (const file of files) {
    const target = path.join(projectDir, file.path);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.content);
  }
}

async function readProjectSourceFiles(projectDir, currentDir = projectDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await readProjectSourceFiles(projectDir, absolute)));
      continue;
    }

    if (!sourceExtensions.has(path.extname(entry.name))) {
      continue;
    }

    files.push({
      path: path.relative(projectDir, absolute).replaceAll(path.sep, "/"),
      content: await readFile(absolute, "utf8")
    });
  }

  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function verifyProject({
  project,
  files,
  source,
  sourceFiles,
  routeModel,
  metadataSummaries,
  configSummary
}) {
  const cases = [];
  for (const route of project.expectedRoutes) {
    const match = routeModel.routes.find(
      (item) => item.route === route.route && item.router === route.router
    );
    assert(
      match,
      `${project.id} must include ${route.router} route ${route.route}`
    );
  }
  cases.push({
    id: "route-model-from-filesystem-project",
    status: "PASS",
    evidence: {
      routes: routeModel.routes.map((route) => ({
        route: route.route,
        router: route.router,
        pageFile: route.pageFile,
        dynamicSegments: route.dynamicSegments
      }))
    }
  });

  const exactFindings = project.exactExpectations.map((expectation) =>
    verifyExactFinding(project.id, files, source.findings, expectation)
  );
  cases.push({
    id: "exact-source-lines-resolve-to-file-content",
    status: "PASS",
    evidence: exactFindings
  });

  const relatedFindings = project.relatedExpectations.map((expectation) =>
    verifyRelatedFinding(project.id, source.findings, expectation)
  );
  cases.push({
    id: "related-source-findings-do-not-fabricate-lines",
    status: "PASS",
    evidence: relatedFindings
  });

  if (project.expectedConfigEntries) {
    assert(
      configSummary.redirectEntries.length ===
        project.expectedConfigEntries.redirects,
      `${project.id} redirect entry count mismatch`
    );
    assert(
      configSummary.rewriteEntries.length ===
        project.expectedConfigEntries.rewrites,
      `${project.id} rewrite entry count mismatch`
    );
    cases.push({
      id: "next-config-entry-source-mapping",
      status: "PASS",
      evidence: {
        redirectEntries: configSummary.redirectEntries,
        rewriteEntries: configSummary.rewriteEntries
      }
    });
  }

  return {
    id: project.id,
    projectRoot: `<temporary>/${project.id}`,
    sourceFileCount: files.length,
    discoveredSourceFileCount: sourceFiles.length,
    routeCount: routeModel.routes.length,
    metadataSummaryCount: metadataSummaries.length,
    findingCount: source.findings.length,
    findingKindCounts: findingKindCounts(source.findings),
    cases
  };
}

function verifyExactFinding(projectId, files, findings, expectation) {
  const finding = findFinding(findings, expectation);
  assert(finding, `${projectId} missing exact finding ${expectation.id}`);
  assert(
    finding.location.confidence === "EXACT",
    `${projectId} ${expectation.id} must be EXACT`
  );
  assert(
    finding.location.line !== undefined,
    `${projectId} ${expectation.id} must include a line`
  );

  const file = files.find((item) => item.path === finding.file);
  assert(
    file,
    `${projectId} ${expectation.id} file not found: ${finding.file}`
  );
  const lineText = file.content.split(/\r?\n/)[finding.location.line - 1] ?? "";
  assert(
    lineText.includes(expectation.marker),
    `${projectId} ${expectation.id} line ${finding.location.line} must include ${expectation.marker}`
  );

  return {
    id: expectation.id,
    kind: finding.kind,
    file: finding.file,
    line: finding.location.line,
    marker: expectation.marker,
    lineText: lineText.trim()
  };
}

function verifyRelatedFinding(projectId, findings, expectation) {
  const finding = findFinding(findings, expectation);
  assert(finding, `${projectId} missing related finding ${expectation.id}`);
  assert(
    finding.location.confidence === "RELATED",
    `${projectId} ${expectation.id} must be RELATED`
  );
  assert(
    finding.location.line === undefined,
    `${projectId} ${expectation.id} must not include a fabricated line`
  );

  return {
    id: expectation.id,
    kind: finding.kind,
    file: finding.file,
    confidence: finding.location.confidence
  };
}

function findFinding(findings, expectation) {
  return findings.find((finding) => {
    if (
      finding.kind !== expectation.kind ||
      finding.file !== expectation.file
    ) {
      return false;
    }
    if (expectation.field && finding.field !== expectation.field) {
      return false;
    }
    if (expectation.route && finding.route !== expectation.route) {
      return false;
    }
    return true;
  });
}

const projectFixtures = [
  {
    id: "real-app-router-project",
    files: [
      {
        path: "src/app/layout.tsx",
        content: `export const metadata = {
  title: "Real App Root",
  description: "Real filesystem App Router fixture"
};

export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`
      },
      {
        path: "src/app/(shop)/products/[slug]/page.tsx",
        content: `import Image from "next/image";

export const metadata = {
  title: "Real App Product",
  openGraph: {
    title: "Real App Product"
  }
};

export async function generateMetadata() {
  return { description: await loadDescription() };
}

export async function generateStaticParams() {
  return [{ slug: "one" }];
}

export default function ProductPage() {
  return <Image src="/product.png" alt="Product" width={1200} height={630} unoptimized />;
}
`
      },
      {
        path: "src/app/(shop)/products/[slug]/opengraph-image.tsx",
        content: `export default function OpenGraphImage() {
  return null;
}
`
      },
      {
        path: "src/app/docs/[[...slug]]/page.tsx",
        content: `export default function DocsPage() {
  return null;
}
`
      },
      {
        path: "src/app/robots.ts",
        content: `export default function robots() {
  return {};
}
`
      },
      {
        path: "src/app/sitemap.ts",
        content: `export async function generateSitemaps() {
  return [{ id: 0 }];
}

export default function sitemap() {
  return [];
}
`
      },
      {
        path: "src/middleware.ts",
        content: `export function middleware() {
  return Response.next();
}
`
      }
    ],
    expectedRoutes: [
      { router: "app", route: "/products/[slug]" },
      { router: "app", route: "/docs/[[...slug]]" }
    ],
    exactExpectations: [
      {
        id: "app-root-title",
        kind: "static-metadata-field",
        file: "src/app/layout.tsx",
        field: "title",
        marker: "title:"
      },
      {
        id: "app-product-title",
        kind: "static-metadata-field",
        file: "src/app/(shop)/products/[slug]/page.tsx",
        field: "title",
        marker: "title:"
      },
      {
        id: "app-unoptimized-image",
        kind: "next-image-unoptimized",
        file: "src/app/(shop)/products/[slug]/page.tsx",
        route: "/products/[slug]",
        marker: "unoptimized"
      },
      {
        id: "app-opengraph-image-file",
        kind: "opengraph-image-file",
        file: "src/app/(shop)/products/[slug]/opengraph-image.tsx",
        route: "/products/[slug]",
        marker: "OpenGraphImage"
      },
      {
        id: "app-robots-file",
        kind: "robots-file",
        file: "src/app/robots.ts",
        marker: "robots"
      },
      {
        id: "app-middleware-file",
        kind: "middleware-file",
        file: "src/middleware.ts",
        marker: "middleware"
      }
    ],
    relatedExpectations: [
      {
        id: "app-generate-metadata",
        kind: "generate-metadata",
        file: "src/app/(shop)/products/[slug]/page.tsx"
      },
      {
        id: "app-generate-static-params",
        kind: "generate-static-params",
        file: "src/app/(shop)/products/[slug]/page.tsx"
      },
      {
        id: "app-generate-sitemaps",
        kind: "generate-sitemaps",
        file: "src/app/sitemap.ts"
      }
    ]
  },
  {
    id: "real-pages-router-project",
    files: [
      {
        path: "src/pages/index.tsx",
        content: `import Head from "next/head";

export default function HomePage() {
  return (
    <Head>
      <title>Real Pages Home</title>
      <meta name="description" content="Real filesystem Pages Router fixture" />
    </Head>
  );
}
`
      },
      {
        path: "src/pages/products/[slug].tsx",
        content: `import Head from "next/head";

export default function ProductPage() {
  return (
    <Head>
      <title>Real Pages Product</title>
    </Head>
  );
}
`
      },
      {
        path: "src/pages/docs/[...slug].tsx",
        content: `export default function DocsPage() {
  return null;
}
`
      },
      {
        path: "next.config.mjs",
        content: `const nextConfig = {
  async redirects() {
    return [
      { source: "/old-pages", destination: "/new-pages", permanent: true }
    ];
  },
  rewrites: async () => [
    { source: "/proxy/:path*", destination: "https://example.com/:path*" }
  ]
};

export default nextConfig;
`
      }
    ],
    expectedRoutes: [
      { router: "pages", route: "/" },
      { router: "pages", route: "/products/[slug]" },
      { router: "pages", route: "/docs/[...slug]" }
    ],
    exactExpectations: [
      {
        id: "pages-home-head",
        kind: "pages-head",
        file: "src/pages/index.tsx",
        route: "/",
        marker: "<Head>"
      },
      {
        id: "pages-product-head",
        kind: "pages-head",
        file: "src/pages/products/[slug].tsx",
        route: "/products/[slug]",
        marker: "<Head>"
      }
    ],
    relatedExpectations: [
      {
        id: "pages-config-redirects",
        kind: "next-config-redirects",
        file: "next.config.mjs"
      },
      {
        id: "pages-config-rewrites",
        kind: "next-config-rewrites",
        file: "next.config.mjs"
      }
    ],
    expectedConfigEntries: {
      redirects: 1,
      rewrites: 1
    }
  }
];

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
