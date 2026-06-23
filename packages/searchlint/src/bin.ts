#!/usr/bin/env node
import process from "node:process";

import {
  runSearchLintNodeCli,
  type CliProcessLike
} from "@searchlint/cli/node";

await runSearchLintNodeCli(process as CliProcessLike);
