# Container Image Contracts

Status date: 2026-06-21

## Scope

This contract covers SearchLint Cloud 1.0 product image definitions for:

- API service: `Dockerfile.api`
- Crawler worker service: `Dockerfile.worker`

It does not publish images, select a registry, pin release digests, deploy ECS
task definitions, or provision AWS resources.

## Runtime Base Image

Approved by OD-027 and ADR `docs/adr/0027-docker-base-image.md`:

```text
node:24-bookworm-slim
```

Both product Dockerfiles must use this image family for build and runtime stages
until a later ADR changes the container base-image policy.

## Build Contract

Product Dockerfiles must:

- use the monorepo root as build context;
- activate pnpm `11.8.0` through Corepack;
- install dependencies with `pnpm install --frozen-lockfile`;
- build the workspace with the documented root `pnpm build` command;
- create a production runtime layout with `pnpm deploy --legacy --prod /app`;
- copy only the deployed `/app` output into the runtime stage;
- avoid copying source files, tests, local environment files, reports, or VCS
  metadata into runtime images.

`--legacy` is required because this workspace does not enable pnpm injected
workspace packages.

## Runtime Contract

Runtime images must:

- set `NODE_ENV=production`;
- run as the non-root `node` user;
- execute built JavaScript from `dist/src/bin.js`;
- depend on service environment variables for real deployment credentials and
  resource names;
- leave registry, digest pinning, deployment-time CPU/memory values, and real
  AWS deployment to later release gates.

API image defaults:

- `SEARCHLINT_API_HOST=0.0.0.0`
- `SEARCHLINT_API_PORT=3000`
- `EXPOSE 3000`
- `CMD ["node", "dist/src/bin.js"]`

Worker image defaults:

- `CMD ["node", "dist/src/bin.js"]`

## Local Build Commands

These commands build local images when Docker is available:

```bash
docker build -f Dockerfile.api -t searchlint-api:local .
docker build -f Dockerfile.worker -t searchlint-crawler-worker:local .
```

Local smoke commands require environment values for PostgreSQL, rate limiting,
SQS, and S3 dependencies. Those runtime integrations are not proven by this
contract.

## Verification

`node scripts/verify-dockerfiles.mjs` validates the static Dockerfile contract
without a Docker daemon.

`node scripts/verify-ci-workflow.mjs` validates that CI contains a build-only
Docker image gate, vulnerability scans, SBOM artifact generation, and SBOM
provenance attestation for both product images and does not contain registry
login or push steps.

`node scripts/verify-aws-iac.mjs` validates the static AWS CloudFormation
deployment contracts currently checked in for the Cognito user pool, Cloud API
service, KMS/Secrets Manager vault, RDS PostgreSQL, S3 artifact storage, crawler
worker service, CloudWatch/OTLP observability, and report artifact cleanup
scheduling.

`pnpm lint` runs both verifiers as part of repository validation.

GitHub Actions job `docker-image-build` builds:

```bash
docker build -f Dockerfile.api -t searchlint-api:ci .
docker build -f Dockerfile.worker -t searchlint-crawler-worker:ci .
```

The same job scans both local `:ci` images with `aquasecurity/trivy-action` and
fails on fixable `CRITICAL` OS or library vulnerabilities. Upstream base-image
CVEs with no available fixed version are excluded by Trivy's `ignore-unfixed`
mode until the approved runtime image family or digest can be refreshed:

```text
searchlint-api:ci
searchlint-crawler-worker:ci
```

The same job also generates CycloneDX JSON SBOM artifacts:

```text
reports/sbom/searchlint-api.cdx.json
reports/sbom/searchlint-crawler-worker.cdx.json
```

The SBOM files are uploaded as the `searchlint-image-sboms` artifact and signed
through GitHub artifact attestations using `actions/attest-build-provenance`.

Registry pushes, release digest pinning, container image signing/provenance, and
ECS task execution remain separate release gates.
