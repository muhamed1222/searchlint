#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const reportPath = path.join(
  repoRoot,
  "reports/next-analyzer-acceptance-report.json"
);
const samplePath = path.join(
  repoRoot,
  "docs/examples/next-analyzer-acceptance-report.sample.json"
);
const fixedGeneratedAt = "2026-06-22T00:00:00.000Z";

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

  const files = [
    {
      path: "app/layout.tsx",
      content: `export const metadata = {
  title: "Example",
  openGraph: {
    title: "Example"
  }
};
export default function Layout({ children }) {
  return children;
}
`
    },
    {
      path: "app/page.tsx",
      content: `export const metadata = {
  description: "Home"
};
export default function Page() {
  return null;
}
`
    },
    {
      path: "app/(marketing)/about/page.tsx",
      content: `export async function generateMetadata() {
  return { title: await getTitle() };
}
export default function Page() {
  return null;
}
`
    },
    {
      path: "app/@modal/(.)photos/[id]/page.tsx",
      content: `export async function generateStaticParams() {
  return [{ id: "1" }];
}
export default function Page() {
  return null;
}
`
    },
    {
      path: "app/docs/[[...slug]]/page.tsx",
      content: `export const metadata = {
  robots: {
    index: true
  }
};
export default function Page() {
  return null;
}
`
    },
    {
      path: "app/blog/[...slug]/page.tsx",
      content: `export default function Page() {
  return null;
}
`
    },
    {
      path: "app/products/[slug]/page.tsx",
      content: `import Image from "next/image";
export const metadata = {
  title: "Product",
  description: "Product page",
  twitter: {
    card: "summary_large_image"
  }
};
export default function Page() {
  return <Image src="/p.png" alt="Product" width={1200} height={630} unoptimized />;
}
`
    },
    {
      path: "app/products/[slug]/route.ts",
      content: `export async function GET() {
  return Response.json({});
}
`
    },
    {
      path: "app/products/[slug]/opengraph-image.tsx",
      content: `export default function Image() {
  return null;
}
`
    },
    {
      path: "app/products/[slug]/twitter-image.tsx",
      content: `export default function Image() {
  return null;
}
`
    },
    {
      path: "app/robots.ts",
      content: `export default function robots() {
  return {};
}
`
    },
    {
      path: "app/sitemap.ts",
      content: `export async function generateSitemaps() {
  return [{ id: 0 }];
}
export default function sitemap() {
  return [];
}
`
    },
    {
      path: "pages/index.tsx",
      content: `export default function Page() {
  return null;
}
`
    },
    {
      path: "pages/products/[slug].tsx",
      content: `import Head from "next/head";

export default function Page() {
  return (
    <Head>
      <title>Product</title>
      <meta name="description" content="Product page" />
    </Head>
  );
}
`
    },
    {
      path: "pages/docs/[...slug].tsx",
      content: `export default function Page() {
  return null;
}
`
    },
    {
      path: "pages/blog/[[...slug]].tsx",
      content: `export default function Page() {
  return null;
}
`
    },
    {
      path: "next.config.mjs",
      content: `const nextConfig = {
  async redirects() {
    return [
      { source: "/old", destination: "/new", permanent: true },
      { source: "/legacy/:slug", destination: "/blog/:slug", permanent: false }
    ];
  },
  rewrites: async () => [
    { source: "/proxy/:path*", destination: "https://example.com/:path*" }
  ]
};
export default nextConfig;
`
    },
    {
      path: "middleware.ts",
      content: `export function middleware() {
  return Response.next();
}
`
    },
    {
      path: "proxy.ts",
      content: `export function proxy() {
  return Response.next();
}
`
    }
  ];

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
      ["next-config-redirects", "next-config-rewrites"].includes(finding.kind)
    )
  );

  const cases = [];

  const routes = routeModel.routes.map((route) => route.route);
  const requiredRoutes = [
    "/",
    "/about",
    "/blog/[...slug]",
    "/blog/[[...slug]]",
    "/docs/[...slug]",
    "/docs/[[...slug]]",
    "/photos/[id]",
    "/products/[slug]"
  ];
  for (const route of requiredRoutes) {
    assert(routes.includes(route), `Route model must include ${route}`);
  }
  assert(
    !routes.some(
      (route) =>
        route.includes("@") ||
        route.includes("(marketing)") ||
        route.includes("(.)")
    ),
    "Public routes must not include App Router implementation-only segments"
  );
  cases.push(
    caseResult("route-model-covers-next-route-shapes", "PASS", {
      routeCount: routeModel.routes.length,
      routes
    })
  );

  const productRoute = routeModel.routes.find(
    (route) => route.route === "/products/[slug]" && route.router === "app"
  );
  assert(
    productRoute?.routeHandler === "app/products/[slug]/route.ts",
    "Route handler must attach to matching App route"
  );
  assert(
    productRoute?.dynamicSegments.includes("[slug]"),
    "Dynamic segment must be preserved"
  );
  cases.push(
    caseResult("route-handlers-and-dynamic-segments", "PASS", {
      route: productRoute?.route,
      routeHandler: productRoute?.routeHandler,
      dynamicSegments: productRoute?.dynamicSegments
    })
  );

  const homeSummary = metadataSummaries.find((item) => item.route === "/");
  assert(
    homeSummary?.staticFields.some(
      (field) => field.field === "title" && field.inherited
    ),
    "Home route must inherit root layout title"
  );
  assert(
    homeSummary?.staticFields.some(
      (field) => field.field === "description" && !field.inherited
    ),
    "Home route must include route-local description"
  );
  const aboutSummary = metadataSummaries.find(
    (item) => item.route === "/about"
  );
  assert(
    aboutSummary?.dynamicMetadata.some((item) => !item.inherited),
    "About route must include route-local dynamic metadata"
  );
  cases.push(
    caseResult("metadata-summary-static-inheritance-and-dynamic", "PASS", {
      home: homeSummary,
      about: aboutSummary
    })
  );

  assert(
    source.findings.some(
      (finding) =>
        finding.kind === "static-metadata-field" &&
        finding.field === "title" &&
        finding.location.confidence === "EXACT" &&
        finding.location.line !== undefined
    ),
    "Static metadata fields must have exact line evidence"
  );
  assert(
    source.findings.some(
      (finding) =>
        finding.kind === "generate-metadata" &&
        finding.location.confidence === "RELATED" &&
        finding.location.line === undefined
    ),
    "Dynamic metadata must be related without fabricated exact line"
  );
  cases.push(
    caseResult("source-location-confidence-policy", "PASS", {
      findingKindCounts: findingKindCounts(source.findings)
    })
  );

  assert(
    configSummary.configFiles.includes("next.config.mjs"),
    "Config summary must include next.config.mjs"
  );
  assert(
    configSummary.redirectsFiles.includes("next.config.mjs"),
    "Redirect source signal must be summarized"
  );
  assert(
    configSummary.rewritesFiles.includes("next.config.mjs"),
    "Rewrite source signal must be summarized"
  );
  assert(
    configSummary.redirectEntries.length === 2,
    "Redirect entries must be statically extracted"
  );
  assert(
    configSummary.rewriteEntries.length === 1,
    "Rewrite entries must be statically extracted"
  );
  cases.push(
    caseResult("redirects-and-rewrites-source-signals", "PASS", configSummary)
  );

  const pagesHeadFinding = source.findings.find(
    (finding) =>
      finding.kind === "pages-head" &&
      finding.route === "/products/[slug]" &&
      finding.location.confidence === "EXACT"
  );
  assert(
    pagesHeadFinding,
    "Pages Router next/head usage must be detected with exact source evidence"
  );
  cases.push(
    caseResult("pages-router-head-source-signal", "PASS", {
      finding: pagesHeadFinding
    })
  );

  const middlewareFinding = source.findings.find(
    (finding) =>
      finding.kind === "middleware-file" &&
      finding.file === "middleware.ts" &&
      finding.location.confidence === "EXACT"
  );
  assert(
    middlewareFinding,
    "Middleware file must be detected with exact source evidence"
  );
  cases.push(
    caseResult("middleware-source-signal", "PASS", {
      finding: middlewareFinding
    })
  );

  const proxyFinding = source.findings.find(
    (finding) =>
      finding.kind === "proxy-file" &&
      finding.file === "proxy.ts" &&
      finding.location.confidence === "EXACT"
  );
  assert(
    proxyFinding,
    "Proxy file must be detected with exact source evidence"
  );
  cases.push(
    caseResult("proxy-source-signal", "PASS", {
      finding: proxyFinding
    })
  );

  assert(
    source.findings.some(
      (finding) =>
        finding.kind === "opengraph-image-file" &&
        finding.route === "/products/[slug]"
    ),
    "Open Graph image route source signal must be present"
  );
  assert(
    source.findings.some(
      (finding) =>
        finding.kind === "twitter-image-file" &&
        finding.route === "/products/[slug]"
    ),
    "Twitter image route source signal must be present"
  );
  assert(
    source.findings.some((finding) => finding.kind === "generate-sitemaps"),
    "generateSitemaps source signal must be present"
  );
  cases.push(
    caseResult("generated-assets-and-special-route-signals", "PASS", {
      generatedSignals: source.findings
        .filter((finding) =>
          [
            "opengraph-image-file",
            "twitter-image-file",
            "robots-file",
            "sitemap-file",
            "generate-sitemaps",
            "generate-static-params"
          ].includes(finding.kind)
        )
        .map((finding) => ({
          kind: finding.kind,
          file: finding.file,
          route: finding.route
        }))
    })
  );

  const expectedFindingKinds = [
    "generate-metadata",
    "generate-sitemaps",
    "generate-static-params",
    "middleware-file",
    "next-config-redirects",
    "next-config-rewrites",
    "next-image-unoptimized",
    "next-route",
    "opengraph-image-file",
    "pages-head",
    "proxy-file",
    "robots-file",
    "sitemap-file",
    "static-metadata-field",
    "static-metadata-object",
    "twitter-image-file"
  ];
  const kindCounts = findingKindCounts(source.findings);
  for (const kind of expectedFindingKinds) {
    assert(kindCounts[kind] > 0, `Source fixture must include ${kind}`);
  }
  cases.push(
    caseResult("source-analyzer-fixture-kind-coverage", "PASS", {
      expectedFindingKinds,
      findingKindCounts: kindCounts
    })
  );

  const failedCases = cases.filter((item) => item.status !== "PASS");
  const summary = {
    status: failedCases.length === 0 ? "PASS" : "FAIL",
    generatedAt: fixedGeneratedAt,
    nodeVersion: process.version,
    caseCount: cases.length,
    passed: cases.length - failedCases.length,
    failed: failedCases.length,
    sourceFileCount: files.length,
    routeCount: routeModel.routes.length,
    findingCount: source.findings.length
  };
  const report = {
    schemaVersion: 1,
    summary,
    cases,
    limitations: [
      "Dynamic metadata is detected as a related source contribution; CMS/API metadata values are not executed.",
      "Literal redirects and rewrites are extracted as config source signals; dynamic config execution and route-effect expansion remain out of scope.",
      "Streaming metadata runtime behavior remains covered by future runtime acceptance, not this static analyzer verifier."
    ]
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(samplePath, `${JSON.stringify(report, null, 2)}\n`);
  run("pnpm", ["exec", "prettier", "--write", samplePath]);

  if (summary.status !== "PASS") {
    process.exitCode = 1;
  }

  console.log(
    `Next analyzer acceptance ${summary.status}: ${summary.passed}/${summary.caseCount} cases passed`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
