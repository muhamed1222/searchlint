#!/usr/bin/env node
import process from "node:process";

import { runSearchLintExternalObservationCollectionNodeProcess } from "./external-observation-collection-node.js";

await runSearchLintExternalObservationCollectionNodeProcess(process);
