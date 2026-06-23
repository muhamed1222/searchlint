#!/usr/bin/env node
import { createConnection, ProposedFeatures } from "vscode-languageserver/node";

import { createSearchLintLanguageServer } from "./server.js";

const connection = createConnection(ProposedFeatures.all);
createSearchLintLanguageServer(connection);
connection.listen();
