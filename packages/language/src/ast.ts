export type Position = {
  offset: number;
  line: number;
  column: number;
};

export type SourceSpan = {
  start: Position;
  end: Position;
};

export type SyntaxDiagnostic = {
  code: string;
  message: string;
  span: SourceSpan;
};

export type AstNodeBase = {
  span: SourceSpan;
};

export type IdentifierNode = AstNodeBase & {
  kind: "Identifier";
  name: string;
};

export type StringLiteralNode = AstNodeBase & {
  kind: "StringLiteral";
  value: string;
};

export type NumberLiteralNode = AstNodeBase & {
  kind: "NumberLiteral";
  value: number;
};

export type BooleanLiteralNode = AstNodeBase & {
  kind: "BooleanLiteral";
  value: boolean;
};

export type LiteralNode =
  | IdentifierNode
  | StringLiteralNode
  | NumberLiteralNode
  | BooleanLiteralNode
  | ListLiteralNode
  | VariableReferenceNode;

export type ListLiteralNode = AstNodeBase & {
  kind: "ListLiteral";
  values: readonly LiteralNode[];
};

export type VariableReferenceNode = AstNodeBase & {
  kind: "VariableReference";
  name: string;
};

export type ImportDeclarationNode = AstNodeBase & {
  kind: "ImportDeclaration";
  path: StringLiteralNode;
};

export type LanguageDeclarationNode = AstNodeBase & {
  kind: "LanguageDeclaration";
  version: NumberLiteralNode;
};

export type SiteDeclarationNode = AstNodeBase & {
  kind: "SiteDeclaration";
  url: StringLiteralNode;
};

export type VariableDeclarationNode = AstNodeBase & {
  kind: "VariableDeclaration";
  name: IdentifierNode;
  value: LiteralNode;
};

export type PropertyDeclarationNode = AstNodeBase & {
  kind: "PropertyDeclaration";
  name: IdentifierNode;
  value: LiteralNode;
  values: readonly LiteralNode[];
};

export type BlockDeclarationNode = AstNodeBase & {
  kind: "BlockDeclaration";
  name: IdentifierNode;
  argument?: LiteralNode;
  body: readonly RouteMemberNode[];
};

export type RouteMemberNode = PropertyDeclarationNode | BlockDeclarationNode;

export type RouteDeclarationNode = AstNodeBase & {
  kind: "RouteDeclaration";
  pattern: StringLiteralNode;
  body: readonly RouteMemberNode[];
};

export type EnvironmentDeclarationNode = AstNodeBase & {
  kind: "EnvironmentDeclaration";
  name: IdentifierNode;
  body: readonly TopLevelDeclarationNode[];
};

export type PolicyDeclarationNode = AstNodeBase & {
  kind: "PolicyDeclaration";
  name: IdentifierNode;
  body: readonly RouteMemberNode[];
};

export type RouteGroupDeclarationNode = AstNodeBase & {
  kind: "RouteGroupDeclaration";
  name: StringLiteralNode;
  body: readonly RouteDeclarationNode[];
};

export type TopLevelDeclarationNode =
  | ImportDeclarationNode
  | LanguageDeclarationNode
  | SiteDeclarationNode
  | VariableDeclarationNode
  | PolicyDeclarationNode
  | RouteGroupDeclarationNode
  | RouteDeclarationNode
  | EnvironmentDeclarationNode;

export type SearchLintDocumentNode = AstNodeBase & {
  kind: "SearchLintDocument";
  declarations: readonly TopLevelDeclarationNode[];
};

export type ParseResult = {
  ast: SearchLintDocumentNode;
  diagnostics: readonly SyntaxDiagnostic[];
};
