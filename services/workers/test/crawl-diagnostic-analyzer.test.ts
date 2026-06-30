import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { createCoreCrawlDiagnosticAnalyzer } from "../src/index.js";
import type { CrawlJobPayload } from "@searchlint/api";
import type { CrawlResult } from "@searchlint/crawler";

describe("createCoreCrawlDiagnosticAnalyzer", () => {
  it("maps crawled pages through shared core diagnostics for ingestion", async () => {
    const analyzer = createCoreCrawlDiagnosticAnalyzer({
      catalogText: readFileSync(
        new URL("../../../specs/RULE_CATALOG.yaml", import.meta.url),
        "utf8"
      )
    });

    const diagnostics = await analyzer.analyzeCrawlDiagnostics({
      payload: crawlPayload(),
      target: {
        startUrl: "https://example.com/"
      },
      result: crawlResult(),
      observedAt: "2026-06-21T00:00:01.000Z"
    });

    expect(diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "SL-META-001",
          severity: "blocker",
          confidence: "certain",
          pageUrl: "https://example.com/",
          route: "/",
          source: "raw-html",
          title: "Route is missing a title",
          evidence: expect.stringContaining("title"),
          observedAt: "2026-06-21T00:00:01.000Z",
          fingerprint: expect.any(String)
        })
      ])
    );
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        ruleId: "SL-CANON-001",
        source: "raw-html"
      })
    );
  });
});

function crawlPayload(): CrawlJobPayload {
  return {
    crawlRequestId: "crawl-1",
    organizationId: "org-1",
    projectId: "project-1",
    environmentId: "env-1",
    maxUrls: 5
  };
}

function crawlResult(): CrawlResult {
  return {
    startUrl: "https://example.com/",
    pages: [
      {
        url: "https://example.com/",
        statusCode: 200,
        headers: {
          "content-type": "text/html"
        },
        body: "<html><head></head><body><h1>Home</h1></body></html>",
        contentType: "text/html",
        discoveredLinks: []
      }
    ],
    skipped: []
  };
}
