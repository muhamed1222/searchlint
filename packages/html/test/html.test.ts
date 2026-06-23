import { describe, expect, it } from "vitest";

import {
  createHtmlSnapshotFragment,
  getAttribute,
  summarizeHtmlDocument
} from "../src/index.js";

describe("createHtmlSnapshotFragment", () => {
  it("creates a PageSnapshot fragment without fabricating missing sources", () => {
    expect(
      createHtmlSnapshotFragment({
        pageUrl: "https://example.com/",
        capturedAt: "2026-06-20T00:00:00.000Z",
        rawHtml: "<html><head></head><body></body></html>"
      })
    ).toEqual({
      pageUrl: "https://example.com/",
      capturedAt: "2026-06-20T00:00:00.000Z",
      rawHtml: "<html><head></head><body></body></html>"
    });
  });
});

describe("summarizeHtmlDocument", () => {
  it("extracts stable document fields used by SearchLint rules", () => {
    const summary = summarizeHtmlDocument(`<!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="description" content="Useful &amp; accurate">
          <link rel="canonical" href="https://example.com/">
          <title>Example &amp; Product</title>
          <script type="application/ld+json">{"@type":"Product"}</script>
        </head>
        <body>
          <h1 data-id="hero">Main <span>Heading</span></h1>
          <img src="/image.png" alt="Preview">
        </body>
      </html>`);

    expect(summary.headCount).toBe(1);
    expect(summary.bodyCount).toBe(1);
    expect(summary.documentLang).toBe("en");
    expect(summary.titles).toEqual(["Example & Product"]);
    expect(summary.jsonLdScripts).toEqual(['{"@type":"Product"}']);
    expect(summary.headings).toMatchObject([
      { tagName: "h1", text: "Main Heading" }
    ]);
    expect(getAttribute(summary.meta[1]!, "content")).toBe("Useful & accurate");
    expect(getAttribute(summary.links[0]!, "href")).toBe(
      "https://example.com/"
    );
    expect(getAttribute(summary.images[0]!, "alt")).toBe("Preview");
  });
});
