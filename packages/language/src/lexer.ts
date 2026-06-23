import type { Position, SourceSpan, SyntaxDiagnostic } from "./ast.js";

export type TokenKind =
  | "identifier"
  | "string"
  | "number"
  | "boolean"
  | "variable"
  | "leftBrace"
  | "rightBrace"
  | "leftBracket"
  | "rightBracket"
  | "comma"
  | "eof";

export type Token = {
  kind: TokenKind;
  text: string;
  value?: string | number | boolean;
  span: SourceSpan;
};

export type LexResult = {
  tokens: readonly Token[];
  diagnostics: readonly SyntaxDiagnostic[];
};

type LexerState = {
  source: string;
  index: number;
  line: number;
  column: number;
  diagnostics: SyntaxDiagnostic[];
  tokens: Token[];
};

function position(state: LexerState): Position {
  return {
    offset: state.index,
    line: state.line,
    column: state.column
  };
}

function advance(state: LexerState): string {
  const character = state.source[state.index] ?? "";
  state.index += 1;
  if (character === "\n") {
    state.line += 1;
    state.column = 1;
  } else {
    state.column += 1;
  }
  return character;
}

function span(start: Position, end: Position): SourceSpan {
  return { start, end };
}

function addDiagnostic(
  state: LexerState,
  code: string,
  message: string,
  start: Position,
  end = position(state)
): void {
  state.diagnostics.push({ code, message, span: span(start, end) });
}

function addToken(
  state: LexerState,
  kind: TokenKind,
  text: string,
  start: Position,
  value?: string | number | boolean
): void {
  const token = {
    kind,
    text,
    span: span(start, position(state))
  };

  state.tokens.push(value === undefined ? token : { ...token, value });
}

function readString(state: LexerState, start: Position): void {
  let value = "";
  let terminated = false;

  advance(state);

  while (state.index < state.source.length) {
    const character = state.source[state.index];
    if (character === '"') {
      advance(state);
      terminated = true;
      break;
    }

    if (character === "\n") {
      break;
    }

    if (character === "\\") {
      advance(state);
      const escaped = advance(state);
      value += escaped === "n" ? "\n" : escaped;
      continue;
    }

    value += advance(state);
  }

  if (!terminated) {
    addDiagnostic(state, "SLANG001", "Unterminated string literal.", start);
  }

  addToken(
    state,
    "string",
    state.source.slice(start.offset, state.index),
    start,
    value
  );
}

function readNumber(state: LexerState, start: Position): void {
  while (/\d/.test(state.source[state.index] ?? "")) {
    advance(state);
  }

  const text = state.source.slice(start.offset, state.index);
  addToken(state, "number", text, start, Number(text));
}

function readIdentifier(state: LexerState, start: Position): void {
  while (/[A-Za-z0-9_-]/.test(state.source[state.index] ?? "")) {
    advance(state);
  }

  const text = state.source.slice(start.offset, state.index);
  if (text === "true" || text === "false") {
    addToken(state, "boolean", text, start, text === "true");
    return;
  }

  addToken(state, "identifier", text, start);
}

function readVariable(state: LexerState, start: Position): void {
  advance(state);
  if (!/[A-Za-z_]/.test(state.source[state.index] ?? "")) {
    addDiagnostic(
      state,
      "SLANG003",
      "Expected variable name after '$'.",
      start
    );
    addToken(
      state,
      "variable",
      state.source.slice(start.offset, state.index),
      start,
      ""
    );
    return;
  }

  while (/[A-Za-z0-9_-]/.test(state.source[state.index] ?? "")) {
    advance(state);
  }

  const text = state.source.slice(start.offset, state.index);
  addToken(state, "variable", text, start, text.slice(1));
}

function skipLineComment(state: LexerState): void {
  while (
    state.index < state.source.length &&
    state.source[state.index] !== "\n"
  ) {
    advance(state);
  }
}

export function lex(source: string): LexResult {
  const state: LexerState = {
    source,
    index: 0,
    line: 1,
    column: 1,
    diagnostics: [],
    tokens: []
  };

  while (state.index < source.length) {
    const start = position(state);
    const character = source[state.index] ?? "";

    if (/\s/.test(character)) {
      advance(state);
      continue;
    }

    if (
      character === "#" ||
      (character === "/" && source[state.index + 1] === "/")
    ) {
      skipLineComment(state);
      continue;
    }

    if (character === "{") {
      advance(state);
      addToken(state, "leftBrace", "{", start);
      continue;
    }

    if (character === "}") {
      advance(state);
      addToken(state, "rightBrace", "}", start);
      continue;
    }

    if (character === "[") {
      advance(state);
      addToken(state, "leftBracket", "[", start);
      continue;
    }

    if (character === "]") {
      advance(state);
      addToken(state, "rightBracket", "]", start);
      continue;
    }

    if (character === ",") {
      advance(state);
      addToken(state, "comma", ",", start);
      continue;
    }

    if (character === "$") {
      readVariable(state, start);
      continue;
    }

    if (character === '"') {
      readString(state, start);
      continue;
    }

    if (/\d/.test(character)) {
      readNumber(state, start);
      continue;
    }

    if (/[A-Za-z_]/.test(character)) {
      readIdentifier(state, start);
      continue;
    }

    advance(state);
    addDiagnostic(
      state,
      "SLANG002",
      `Unexpected character '${character}'.`,
      start,
      position(state)
    );
  }

  const eofPosition = position(state);
  state.tokens.push({
    kind: "eof",
    text: "",
    span: span(eofPosition, eofPosition)
  });

  return {
    tokens: state.tokens,
    diagnostics: state.diagnostics
  };
}
