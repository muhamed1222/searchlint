#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const generatedAt = "2026-06-22T00:00:00.000Z";
const reportPath = path.join(repoRoot, "reports/crawler-session-report.json");
const samplePath = path.join(
  repoRoot,
  "docs/examples/crawler-session-report.sample.json"
);

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

async function main() {
  run("pnpm", ["build"], { stdio: "inherit" });

  const { crawlSite } = await import("../packages/crawler/dist/src/index.js");
  const cases = [];

  const authFetcher = createMapFetcher({
    "https://example.com/private": html("private")
  });
  const authenticated = await crawlSite(
    {
      startUrl: "https://example.com/private",
      respectRobotsTxt: false,
      requestHeaders: { authorization: "Bearer synthetic-token" }
    },
    authFetcher
  );
  const authHeader = authFetcher.optionsByUrl.get("https://example.com/private")
    ?.headers?.authorization;
  assert(authenticated.pages.length === 1, "Authenticated crawl must fetch");
  assert(authHeader === "Bearer synthetic-token", "Auth header must be sent");
  cases.push({
    id: "authenticated-request-headers",
    status: "PASS",
    evidence: {
      fetchedPages: authenticated.pages.map((page) => page.url),
      observedHeaderNames: ["authorization"],
      secretValues: "redacted"
    }
  });

  const sessionFetcher = createMapFetcher({
    "https://example.com/": response(
      "https://example.com/",
      200,
      '<a href="/account/page">Account</a><a href="/public">Public</a>',
      {
        "content-type": "text/html",
        "set-cookie":
          "session=synthetic-session; Path=/account; HttpOnly; SameSite=Lax"
      }
    ),
    "https://example.com/account/page": html("account"),
    "https://example.com/public": html("public")
  });
  const session = await crawlSite(
    {
      startUrl: "https://example.com/",
      respectRobotsTxt: false,
      maxUrls: 3
    },
    sessionFetcher
  );
  const accountCookie = sessionFetcher.optionsByUrl.get(
    "https://example.com/account/page"
  )?.headers?.cookie;
  const publicCookie = sessionFetcher.optionsByUrl.get(
    "https://example.com/public"
  )?.headers?.cookie;
  assert(session.pages.length === 3, "Session crawl must follow page links");
  assert(
    accountCookie === "session=synthetic-session",
    "Path-matching cookie must be replayed"
  );
  assert(publicCookie === undefined, "Path-scoped cookie must not leak");
  cases.push({
    id: "set-cookie-session-replay",
    status: "PASS",
    evidence: {
      fetchedPages: session.pages.map((page) => page.url),
      replayedCookieNames: ["session"],
      nonMatchingPathCookieSent: false,
      secretValues: "redacted"
    }
  });

  const crossOriginFetcher = createMapFetcher({
    "https://example.com/": html(
      '<a href="/dashboard">Dashboard</a><a href="https://other.example/private">Other</a>'
    ),
    "https://example.com/dashboard": html("dashboard"),
    "https://other.example/private": html("other")
  });
  const crossOrigin = await crawlSite(
    {
      startUrl: "https://example.com/",
      respectRobotsTxt: false,
      sameOrigin: false,
      maxUrls: 3,
      sessionCookies: [
        {
          name: "session",
          value: "synthetic-session",
          domain: "example.com",
          path: "/",
          secure: true
        }
      ]
    },
    crossOriginFetcher
  );
  const rootCookie = crossOriginFetcher.optionsByUrl.get("https://example.com/")
    ?.headers?.cookie;
  const dashboardCookie = crossOriginFetcher.optionsByUrl.get(
    "https://example.com/dashboard"
  )?.headers?.cookie;
  const otherCookie = crossOriginFetcher.optionsByUrl.get(
    "https://other.example/private"
  )?.headers?.cookie;
  assert(crossOrigin.pages.length === 3, "Cross-origin crawl fixture must run");
  assert(rootCookie === "session=synthetic-session", "Initial cookie sent");
  assert(
    dashboardCookie === "session=synthetic-session",
    "Initial cookie reused on same origin"
  );
  assert(otherCookie === undefined, "Cookie must not leak to other origin");
  cases.push({
    id: "initial-cookie-origin-isolation",
    status: "PASS",
    evidence: {
      fetchedPages: crossOrigin.pages.map((page) => page.url),
      sameOriginCookieSent: true,
      crossOriginCookieSent: false,
      secretValues: "redacted"
    }
  });

  const failed = cases.filter((item) => item.status !== "PASS");
  const report = {
    schemaVersion: 1,
    generatedBy: "searchlint-crawler-session-verifier",
    generatedAt,
    status: failed.length === 0 ? "passed" : "failed",
    methodology: {
      liveNetworkAccess: "not used by verifier",
      scope:
        "local @searchlint/crawler authenticated request and cookie/session handling",
      secretPolicy:
        "synthetic credentials only; report records header/cookie names and redacts values"
    },
    summary: {
      caseCount: cases.length,
      passed: cases.length - failed.length,
      failed: failed.length
    },
    cases
  };

  await mkdir(path.dirname(reportPath), { recursive: true });
  await mkdir(path.dirname(samplePath), { recursive: true });
  await writeJson(reportPath, report);
  await writeJson(samplePath, report);

  assert(report.status === "passed", "crawler session verification failed");

  console.log(
    `Crawler session PASS: cases=${cases.length}, auth headers=1, cookie leak=false`
  );
  console.log(`Report: ${path.relative(repoRoot, reportPath)}`);
  console.log(`Sample: ${path.relative(repoRoot, samplePath)}`);
}

function createMapFetcher(responses) {
  const calls = [];
  const optionsByUrl = new Map();
  return {
    calls,
    optionsByUrl,
    async fetch(url, options) {
      calls.push(url);
      optionsByUrl.set(url, options);
      const found = responses[url];
      if (!found) {
        throw new Error(`Unexpected fetch ${url}`);
      }
      return { ...found, url };
    }
  };
}

function html(body) {
  return response("https://example.com/", 200, body, {
    "content-type": "text/html"
  });
}

function response(url, statusCode, body, headers = {}) {
  return {
    url,
    statusCode,
    headers,
    body
  };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
