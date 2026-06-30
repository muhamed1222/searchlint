import process from "node:process";

import { runSearchLintReportArtifactCleanupNodeProcess } from "./report-artifact-cleanup-node.js";

await runSearchLintReportArtifactCleanupNodeProcess(process);
