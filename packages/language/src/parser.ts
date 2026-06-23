import type {
  BlockDeclarationNode,
  BooleanLiteralNode,
  EnvironmentDeclarationNode,
  IdentifierNode,
  ImportDeclarationNode,
  LanguageDeclarationNode,
  ListLiteralNode,
  LiteralNode,
  NumberLiteralNode,
  PolicyDeclarationNode,
  ParseResult,
  Position,
  PropertyDeclarationNode,
  RouteGroupDeclarationNode,
  RouteDeclarationNode,
  RouteMemberNode,
  SearchLintDocumentNode,
  SiteDeclarationNode,
  SourceSpan,
  StringLiteralNode,
  SyntaxDiagnostic,
  TopLevelDeclarationNode,
  VariableDeclarationNode,
  VariableReferenceNode
} from "./ast.js";
import { lex, type Token, type TokenKind } from "./lexer.js";

type ParserState = {
  tokens: readonly Token[];
  index: number;
  diagnostics: SyntaxDiagnostic[];
};

function mergeSpan(start: SourceSpan, end: SourceSpan): SourceSpan {
  return {
    start: start.start,
    end: end.end
  };
}

function emptySpan(position: Position): SourceSpan {
  return {
    start: position,
    end: position
  };
}

function current(state: ParserState): Token {
  return state.tokens[state.index] ?? state.tokens[state.tokens.length - 1]!;
}

function previous(state: ParserState): Token {
  return state.tokens[Math.max(0, state.index - 1)] ?? current(state);
}

function advance(state: ParserState): Token {
  const token = current(state);
  if (token.kind !== "eof") {
    state.index += 1;
  }
  return token;
}

function at(state: ParserState, kind: TokenKind, text?: string): boolean {
  const token = current(state);
  return token.kind === kind && (text === undefined || token.text === text);
}

function addDiagnostic(
  state: ParserState,
  code: string,
  message: string,
  token = current(state)
): void {
  state.diagnostics.push({ code, message, span: token.span });
}

function expect(
  state: ParserState,
  kind: TokenKind,
  text?: string
): Token | undefined {
  if (at(state, kind, text)) {
    return advance(state);
  }

  const expected = text ?? kind;
  addDiagnostic(state, "SLANG100", `Expected ${expected}.`);
  return undefined;
}

function identifierFromToken(token: Token): IdentifierNode {
  return {
    kind: "Identifier",
    name: token.text,
    span: token.span
  };
}

function syntheticIdentifier(name: string, token: Token): IdentifierNode {
  return {
    kind: "Identifier",
    name,
    span: token.span
  };
}

function parseString(state: ParserState): StringLiteralNode | undefined {
  const token = expect(state, "string");
  if (!token) {
    return undefined;
  }

  return {
    kind: "StringLiteral",
    value: String(token.value ?? ""),
    span: token.span
  };
}

function parseNumber(state: ParserState): NumberLiteralNode | undefined {
  const token = expect(state, "number");
  if (!token) {
    return undefined;
  }

  return {
    kind: "NumberLiteral",
    value: Number(token.value),
    span: token.span
  };
}

function parseLiteral(state: ParserState): LiteralNode | undefined {
  const token = current(state);

  if (token.kind === "string") {
    return parseString(state);
  }

  if (token.kind === "number") {
    return parseNumber(state);
  }

  if (token.kind === "boolean") {
    advance(state);
    return {
      kind: "BooleanLiteral",
      value: Boolean(token.value),
      span: token.span
    } satisfies BooleanLiteralNode;
  }

  if (token.kind === "variable") {
    advance(state);
    return {
      kind: "VariableReference",
      name: String(token.value ?? ""),
      span: token.span
    } satisfies VariableReferenceNode;
  }

  if (token.kind === "leftBracket") {
    return parseList(state);
  }

  if (token.kind === "identifier") {
    advance(state);
    return identifierFromToken(token);
  }

  addDiagnostic(state, "SLANG101", "Expected literal value.");
  return undefined;
}

function parseList(state: ParserState): ListLiteralNode | undefined {
  const start = expect(state, "leftBracket");
  if (!start) {
    return undefined;
  }

  const values: LiteralNode[] = [];
  while (!at(state, "rightBracket") && !at(state, "eof")) {
    const value = parseLiteral(state);
    if (value) {
      values.push(value);
    }

    if (at(state, "comma")) {
      advance(state);
      continue;
    }

    if (!at(state, "rightBracket")) {
      addDiagnostic(state, "SLANG105", "Expected ',' or ']'.");
      break;
    }
  }

  const end = expect(state, "rightBracket") ?? previous(state);
  return {
    kind: "ListLiteral",
    values,
    span: mergeSpan(start.span, end.span)
  };
}

function parsePropertyValues(
  state: ParserState,
  nameToken: Token
): readonly LiteralNode[] {
  const values: LiteralNode[] = [];

  while (
    !at(state, "leftBrace") &&
    !at(state, "rightBrace") &&
    !at(state, "eof") &&
    current(state).span.start.line === nameToken.span.start.line
  ) {
    const value = parseLiteral(state);
    if (!value) {
      break;
    }
    values.push(value);
  }

  return values;
}

function parseImport(state: ParserState): ImportDeclarationNode {
  const start = advance(state);
  const path = parseString(state) ?? {
    kind: "StringLiteral",
    value: "",
    span: current(state).span
  };

  return {
    kind: "ImportDeclaration",
    path,
    span: mergeSpan(start.span, path.span)
  };
}

function parseLanguage(state: ParserState): LanguageDeclarationNode {
  const start = advance(state);
  const version = parseNumber(state) ?? {
    kind: "NumberLiteral",
    value: 0,
    span: current(state).span
  };

  return {
    kind: "LanguageDeclaration",
    version,
    span: mergeSpan(start.span, version.span)
  };
}

function parseSite(state: ParserState): SiteDeclarationNode {
  const start = advance(state);
  const url = parseString(state) ?? {
    kind: "StringLiteral",
    value: "",
    span: current(state).span
  };

  return {
    kind: "SiteDeclaration",
    url,
    span: mergeSpan(start.span, url.span)
  };
}

function parseVariable(state: ParserState): VariableDeclarationNode {
  const start = advance(state);
  const nameToken = expect(state, "identifier");
  const name = nameToken
    ? identifierFromToken(nameToken)
    : syntheticIdentifier("", current(state));
  const value = parseLiteral(state) ?? syntheticIdentifier("", current(state));

  return {
    kind: "VariableDeclaration",
    name,
    value,
    span: mergeSpan(start.span, value.span)
  };
}

function parseRoute(state: ParserState): RouteDeclarationNode {
  const start = advance(state);
  const pattern = parseString(state) ?? {
    kind: "StringLiteral",
    value: "",
    span: current(state).span
  };
  const body = parseRouteBody(state);

  return {
    kind: "RouteDeclaration",
    pattern,
    body,
    span: mergeSpan(start.span, previous(state).span)
  };
}

function parseRouteBody(state: ParserState): readonly RouteMemberNode[] {
  const body: RouteMemberNode[] = [];
  if (!expect(state, "leftBrace")) {
    return body;
  }

  while (!at(state, "rightBrace") && !at(state, "eof")) {
    const member = parseRouteMember(state);
    if (member) {
      body.push(member);
      continue;
    }

    advance(state);
  }

  expect(state, "rightBrace");
  return body;
}

function parsePolicy(state: ParserState): PolicyDeclarationNode {
  const start = advance(state);
  const nameToken = expect(state, "identifier");
  const name = nameToken
    ? identifierFromToken(nameToken)
    : syntheticIdentifier("", current(state));
  const body = parseRouteBody(state);

  return {
    kind: "PolicyDeclaration",
    name,
    body,
    span: mergeSpan(start.span, previous(state).span)
  };
}

function parseRouteGroup(state: ParserState): RouteGroupDeclarationNode {
  const start = advance(state);
  const name = parseString(state) ?? {
    kind: "StringLiteral",
    value: "",
    span: current(state).span
  };
  const body: RouteDeclarationNode[] = [];

  if (!expect(state, "leftBrace")) {
    return {
      kind: "RouteGroupDeclaration",
      name,
      body,
      span: mergeSpan(start.span, name.span)
    };
  }

  while (!at(state, "rightBrace") && !at(state, "eof")) {
    const token = current(state);
    if (token.kind === "identifier" && token.text === "route") {
      body.push(parseRoute(state));
      continue;
    }
    addDiagnostic(
      state,
      "SLANG106",
      "Route group may contain only route declarations."
    );
    advance(state);
  }

  expect(state, "rightBrace");
  return {
    kind: "RouteGroupDeclaration",
    name,
    body,
    span: mergeSpan(start.span, previous(state).span)
  };
}

function parseEnvironment(state: ParserState): EnvironmentDeclarationNode {
  const start = advance(state);
  const nameToken = expect(state, "identifier");
  const name = nameToken
    ? identifierFromToken(nameToken)
    : syntheticIdentifier("", current(state));
  const body: TopLevelDeclarationNode[] = [];

  if (!expect(state, "leftBrace")) {
    return {
      kind: "EnvironmentDeclaration",
      name,
      body,
      span: mergeSpan(start.span, name.span)
    };
  }

  while (!at(state, "rightBrace") && !at(state, "eof")) {
    const declaration = parseTopLevel(state, true);
    if (declaration) {
      body.push(declaration);
    }
  }

  expect(state, "rightBrace");
  return {
    kind: "EnvironmentDeclaration",
    name,
    body,
    span: mergeSpan(start.span, previous(state).span)
  };
}

function parseRouteMember(state: ParserState): RouteMemberNode | undefined {
  const nameToken = expect(state, "identifier");
  if (!nameToken) {
    return undefined;
  }

  const name = identifierFromToken(nameToken);
  const values = parsePropertyValues(state, nameToken);
  const firstValue = values[0];

  if (at(state, "leftBrace")) {
    const body = parseRouteBody(state);
    const block = {
      kind: "BlockDeclaration",
      name,
      body,
      span: mergeSpan(name.span, previous(state).span)
    } satisfies BlockDeclarationNode;

    return firstValue ? { ...block, argument: firstValue } : block;
  }

  if (!firstValue) {
    addDiagnostic(
      state,
      "SLANG102",
      `Expected value or block for '${name.name}'.`,
      nameToken
    );
    return {
      kind: "PropertyDeclaration",
      name,
      value: syntheticIdentifier("", nameToken),
      values: [syntheticIdentifier("", nameToken)],
      span: nameToken.span
    };
  }

  return {
    kind: "PropertyDeclaration",
    name,
    value: firstValue,
    values,
    span: mergeSpan(name.span, firstValue.span)
  } satisfies PropertyDeclarationNode;
}

function parseTopLevel(
  state: ParserState,
  inEnvironment = false
): TopLevelDeclarationNode | undefined {
  const token = current(state);
  if (token.kind === "eof") {
    return undefined;
  }

  if (token.kind !== "identifier") {
    addDiagnostic(state, "SLANG103", "Expected top-level declaration.");
    advance(state);
    return undefined;
  }

  if (token.text === "import") {
    return parseImport(state);
  }

  if (token.text === "language") {
    return parseLanguage(state);
  }

  if (token.text === "site") {
    return parseSite(state);
  }

  if (token.text === "let" || token.text === "variable") {
    return parseVariable(state);
  }

  if (token.text === "policy") {
    return parsePolicy(state);
  }

  if (token.text === "group") {
    return parseRouteGroup(state);
  }

  if (token.text === "environment" && !inEnvironment) {
    return parseEnvironment(state);
  }

  if (token.text === "route") {
    return parseRoute(state);
  }

  addDiagnostic(
    state,
    "SLANG104",
    `Unknown top-level declaration '${token.text}'.`,
    token
  );
  advance(state);
  return undefined;
}

export function parseSearchLintDocument(source: string): ParseResult {
  const lexResult = lex(source);
  const state: ParserState = {
    tokens: lexResult.tokens,
    index: 0,
    diagnostics: [...lexResult.diagnostics]
  };
  const declarations: TopLevelDeclarationNode[] = [];

  while (!at(state, "eof")) {
    const declaration = parseTopLevel(state);
    if (declaration) {
      declarations.push(declaration);
    }
  }

  const firstSpan =
    declarations[0]?.span ?? emptySpan(current(state).span.start);
  const lastSpan = declarations[declarations.length - 1]?.span ?? firstSpan;

  const ast: SearchLintDocumentNode = {
    kind: "SearchLintDocument",
    declarations,
    span: mergeSpan(firstSpan, lastSpan)
  };

  return {
    ast,
    diagnostics: state.diagnostics
  };
}
