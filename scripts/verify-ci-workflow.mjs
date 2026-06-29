import { readFile } from "node:fs/promises";

const workflowPath = ".github/workflows/ci.yml";
const workflow = await readFile(workflowPath, "utf8");

const requiredSnippets = [
  "docker-image-build:",
  "runs-on: ubuntu-latest",
  "permissions:",
  "contents: read",
  "id-token: write",
  "attestations: write",
  "uses: actions/checkout@v4",
  "uses: actions/setup-node@v4",
  "node-version: 24",
  "uses: pnpm/action-setup@v4",
  "version: 11.8.0",
  "run: pnpm install --frozen-lockfile",
  "run: node scripts/verify-dockerfiles.mjs",
  "run: docker build -f Dockerfile.api -t searchlint-api:ci .",
  "image-ref: searchlint-api:ci",
  "run: mkdir -p reports/sbom",
  "output: reports/sbom/searchlint-api.cdx.json",
  "run: docker build -f Dockerfile.worker -t searchlint-crawler-worker:ci .",
  "image-ref: searchlint-crawler-worker:ci",
  "output: reports/sbom/searchlint-crawler-worker.cdx.json",
  "uses: actions/upload-artifact@v4",
  "name: searchlint-image-sboms",
  "path: reports/sbom/*.cdx.json",
  "uses: actions/attest-build-provenance@v4",
  "subject-path: reports/sbom/*.cdx.json"
];

const forbiddenPatterns = [
  /\bdocker\s+login\b/i,
  /\bdocker\s+push\b/i,
  /\bghcr\.io\b/i,
  /\bamazonaws\.com\b/i,
  /\becr\b/i
];

for (const snippet of requiredSnippets) {
  assertIncludes(
    workflow,
    snippet,
    `${workflowPath} is missing required CI workflow contract: ${snippet}`
  );
}

for (const pattern of forbiddenPatterns) {
  if (pattern.test(workflow)) {
    throw new Error(
      `${workflowPath} must not include registry login, push, or provider-specific image publishing in the build-only CI gate`
    );
  }
}

const trivyActionCount = countOccurrences(
  workflow,
  "uses: aquasecurity/trivy-action@v0.36.0"
);
if (trivyActionCount !== 4) {
  throw new Error(
    `${workflowPath} must scan and generate SBOMs for both product CI images with aquasecurity/trivy-action@v0.36.0`
  );
}

for (const scan of scanBlocks(workflow)) {
  assertIncludes(scan, "scan-type: image", "Trivy scans must use image mode");
  assertIncludes(scan, "format: table", "Trivy scans must use table output");
  assertIncludes(
    scan,
    "severity: CRITICAL",
    "Trivy scans must fail on critical vulnerabilities"
  );
  assertIncludes(
    scan,
    "vuln-type: os,library",
    "Trivy scans must include OS and library vulnerabilities"
  );
  assertIncludes(
    scan,
    "ignore-unfixed: true",
    "Trivy scans must fail on fixable critical findings without blocking on upstream base-image vulnerabilities that have no fixed version"
  );
  assertIncludes(scan, "exit-code: 1", "Trivy scans must fail CI on findings");
}

for (const sbom of sbomBlocks(workflow)) {
  assertIncludes(
    sbom,
    "scan-type: image",
    "SBOM generation must use image mode"
  );
  assertIncludes(
    sbom,
    "format: cyclonedx",
    "SBOM generation must use CycloneDX output"
  );
  assertIncludes(
    sbom,
    "exit-code: 0",
    "SBOM generation must not fail CI based on SBOM output alone"
  );
}

console.log("verified SearchLint CI workflow contracts");

function assertIncludes(text, expected, message) {
  if (!text.includes(expected)) {
    throw new Error(message);
  }
}

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

function scanBlocks(text) {
  return [
    blockAfter(text, "- name: Scan API image"),
    blockAfter(text, "- name: Scan crawler worker image")
  ];
}

function sbomBlocks(text) {
  return [
    blockAfter(text, "- name: Generate API image SBOM"),
    blockAfter(text, "- name: Generate crawler worker image SBOM")
  ];
}

function blockAfter(text, marker) {
  const start = text.indexOf(marker);
  if (start === -1) {
    throw new Error(`${workflowPath} is missing ${marker}`);
  }
  const nextStep = text.indexOf("\n      - name:", start + marker.length);
  return nextStep === -1 ? text.slice(start) : text.slice(start, nextStep);
}
