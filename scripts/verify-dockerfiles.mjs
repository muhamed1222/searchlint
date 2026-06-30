import { readFile } from "node:fs/promises";

const dockerfiles = [
  {
    path: "Dockerfile.api",
    packageName: "@searchlint/api",
    deployTarget: "/app",
    command: 'CMD ["node", "dist/src/bin.js"]',
    required: [
      "RUN pnpm build",
      "RUN pnpm --filter @searchlint/api deploy --legacy --prod /app",
      "ENV SEARCHLINT_API_HOST=0.0.0.0",
      "ENV SEARCHLINT_API_PORT=3000",
      "EXPOSE 3000"
    ]
  },
  {
    path: "Dockerfile.worker",
    packageName: "@searchlint/workers",
    deployTarget: "/app",
    command: 'CMD ["node", "dist/src/bin.js"]',
    required: [
      "RUN pnpm build",
      "RUN pnpm --filter @searchlint/workers deploy --legacy --prod /app"
    ]
  }
];

const requiredIgnoreEntries = [
  ".git",
  "node_modules",
  "dist",
  "reports",
  ".env",
  ".env.*"
];

for (const dockerfile of dockerfiles) {
  const text = await readFile(dockerfile.path, "utf8");
  const lines = text.split(/\r?\n/);
  const runtimeStage = runtimeStageText(text);

  assertIncludes(
    text,
    "FROM node:24-bookworm-slim AS base",
    `${dockerfile.path} must use the approved Node 24 Bookworm slim base stage`
  );
  assertIncludes(
    text,
    "FROM node:24-bookworm-slim AS runtime",
    `${dockerfile.path} must use the approved Node 24 Bookworm slim runtime stage`
  );
  assertIncludes(
    text,
    "RUN corepack enable && corepack prepare pnpm@11.8.0 --activate",
    `${dockerfile.path} must activate the pinned pnpm version`
  );
  assertIncludes(
    text,
    "RUN pnpm install --frozen-lockfile",
    `${dockerfile.path} must install from the frozen lockfile`
  );
  assertIncludes(
    text,
    `COPY --from=build --chown=node:node ${dockerfile.deployTarget} /app`,
    `${dockerfile.path} runtime stage must copy deployed output with node ownership`
  );
  assertIncludes(
    text,
    "USER node",
    `${dockerfile.path} runtime stage must run as the non-root node user`
  );
  assertIncludes(
    text,
    dockerfile.command,
    `${dockerfile.path} must run the built package entrypoint`
  );

  for (const required of dockerfile.required) {
    assertIncludes(text, required, `${dockerfile.path} is missing ${required}`);
  }

  if (/FROM\s+node:(?!24-bookworm-slim\b)/.test(text)) {
    throw new Error(`${dockerfile.path} uses an unapproved Node base image`);
  }
  if (/FROM\s+.*alpine/i.test(text)) {
    throw new Error(`${dockerfile.path} must not use Alpine for 1.0 runtime`);
  }
  if (/COPY\s+\.\s+\./.test(runtimeStage)) {
    throw new Error(
      `${dockerfile.path} runtime stage must not copy the full build context`
    );
  }

  const userLineIndex = lines.findIndex((line) => line.trim() === "USER node");
  const commandLineIndex = lines.findIndex(
    (line) => line.trim() === dockerfile.command
  );
  if (userLineIndex === -1 || commandLineIndex === -1) {
    throw new Error(`${dockerfile.path} must declare USER node before CMD`);
  }
  if (userLineIndex > commandLineIndex) {
    throw new Error(`${dockerfile.path} must declare USER node before CMD`);
  }
}

const dockerignore = await readFile(".dockerignore", "utf8");
for (const entry of requiredIgnoreEntries) {
  assertIncludes(
    dockerignore,
    entry,
    `.dockerignore must exclude ${entry} from product image contexts`
  );
}

console.log("verified SearchLint product Dockerfile contracts");

function runtimeStageText(text) {
  const marker = "FROM node:24-bookworm-slim AS runtime";
  const index = text.indexOf(marker);
  if (index === -1) {
    return "";
  }
  return text.slice(index);
}

function assertIncludes(text, expected, message) {
  if (!text.includes(expected)) {
    throw new Error(message);
  }
}
