#!/usr/bin/env node
import process from "node:process";

import { runSearchLintCrawlerWorkerNodeProcess } from "./node.js";

await runSearchLintCrawlerWorkerNodeProcess(process);
