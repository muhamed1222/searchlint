# Page Snapshot Schema

## Confirmed Requirement

For any open page, SearchLint must create one `PageSnapshot` containing:

- source code;
- HTTP data;
- raw HTML;
- rendered DOM.

Collectors also gather data from:

- HTTP headers;
- robots.txt;
- sitemap.xml;
- crawler;
- Google;
- Yandex.

## Resolved URL Target Observations

Rules that evaluate canonical, hreflang, image, or link targets must use target
observations already collected by a crawler, CLI, or cloud collector. The core
rule engine does not fetch target URLs.

The current internal TypeScript contract represents these observations as
optional `PageSnapshot.resolvedUrls` entries containing:

- requested `url`;
- final HTTP `statusCode`;
- optional `finalUrl`;
- optional response `headers`;
- optional `redirectChain`;
- optional target `rawHtml`;
- optional `capturedAt`.

Rules may emit target diagnostics only when the required resolved target
evidence is present. Missing target observations must not be treated as failed
targets.

## Site Graph Observations

Rules that evaluate site-level internal linking must use graph observations
already collected by a crawler, CLI, or cloud collector. The core rule engine
does not crawl pages or fetch targets.

The current internal TypeScript contract represents these observations as
optional `PageSnapshot.siteGraph` entries containing:

- `pages`: observed graph pages with `url`, optional `statusCode`, optional
  `finalUrl`, optional `redirectChain`, optional `canonicalUrl`, optional
  `hreflangLinks`, optional `assetUrls`, optional `pagination`, optional
  `title`, optional `description`, optional `indexable`, optional
  `soft404Signals`, optional `crawlDepth`, optional `important`, and optional
  `crawlDepthPolicyMax`;
- `links`: observed crawl graph edges with `sourceUrl`, `targetUrl`, optional
  `rel`, and optional `text`;
- optional internal nofollow policy thresholds.

Rules may emit site graph diagnostics only when the required graph evidence is
present. Missing graph observations must not be treated as failed links,
duplicates, orphan pages, or missing internal links.

## Metadata Timing Observations

Rules that evaluate metadata render timing must use timing observations already
collected by a browser, CLI, or cloud collector. The core rule engine does not
measure render timing.

The current internal TypeScript contract represents this evidence as optional
`PageSnapshot.metadataTiming` containing:

- `availableAtMs`;
- `policyMaxMs`.

Timing diagnostics may be emitted only when both the measurement and explicit
policy threshold are present.

## Approved Storage Model

Approved by OD-007 and ADR `../docs/adr/0007-page-snapshot-storage.md`:

- PageSnapshot metadata is stored in PostgreSQL.
- Large HTML, DOM, and crawl artifacts are stored in S3-compatible object
  storage.

## External Observation Fields

Approved by OD-011:

External observations associated with snapshots must include:

- `observedAt`;
- `fetchedAt`;
- freshness status;
- provider quota information when applicable.

## Raw HTML / Rendered DOM Requirement

SearchLint must compare:

```text
initial HTML
against
DOM after JavaScript execution
```

This is required because Next.js supports static metadata, dynamic metadata, and
streaming metadata.

## Still Pending

- final `PageSnapshot` field names;
- local cache format;
- artifact reference format;
- snapshot diff algorithm;
- data retention and deletion policy: OD-018;
- contract migration policy: OD-025.
