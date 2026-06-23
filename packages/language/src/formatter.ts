import type {
  BlockDeclarationNode,
  EnvironmentDeclarationNode,
  LiteralNode,
  PolicyDeclarationNode,
  RouteGroupDeclarationNode,
  RouteDeclarationNode,
  RouteMemberNode,
  SearchLintDocumentNode,
  TopLevelDeclarationNode
} from "./ast.js";

function formatLiteral(literal: LiteralNode): string {
  if (literal.kind === "StringLiteral") {
    return JSON.stringify(literal.value);
  }

  if (literal.kind === "BooleanLiteral") {
    return literal.value ? "true" : "false";
  }

  if (literal.kind === "NumberLiteral") {
    return String(literal.value);
  }

  if (literal.kind === "ListLiteral") {
    return `[${literal.values.map((value) => formatLiteral(value)).join(", ")}]`;
  }

  if (literal.kind === "VariableReference") {
    return `$${literal.name}`;
  }

  return literal.name;
}

function indent(level: number): string {
  return "  ".repeat(level);
}

function formatRouteMember(member: RouteMemberNode, level: number): string[] {
  if (member.kind === "PropertyDeclaration") {
    return [
      `${indent(level)}${member.name.name} ${member.values
        .map((value) => formatLiteral(value))
        .join(" ")}`
    ];
  }

  return formatBlock(member, level);
}

function formatBlock(block: BlockDeclarationNode, level: number): string[] {
  const header = block.argument
    ? `${indent(level)}${block.name.name} ${formatLiteral(block.argument)} {`
    : `${indent(level)}${block.name.name} {`;

  return [
    header,
    ...block.body.flatMap((member) => formatRouteMember(member, level + 1)),
    `${indent(level)}}`
  ];
}

function formatRoute(route: RouteDeclarationNode): string[] {
  return [
    `route ${formatLiteral(route.pattern)} {`,
    ...route.body.flatMap((member) => formatRouteMember(member, 1)),
    "}"
  ];
}

function formatPolicy(policy: PolicyDeclarationNode): string[] {
  return [
    `policy ${policy.name.name} {`,
    ...policy.body.flatMap((member) => formatRouteMember(member, 1)),
    "}"
  ];
}

function formatRouteGroup(group: RouteGroupDeclarationNode): string[] {
  return [
    `group ${formatLiteral(group.name)} {`,
    ...group.body.flatMap((route, index) => {
      const lines = formatRoute(route).map((line) => `${indent(1)}${line}`);
      return index === group.body.length - 1 ? lines : [...lines, ""];
    }),
    "}"
  ];
}

function formatEnvironment(environment: EnvironmentDeclarationNode): string[] {
  return [
    `environment ${environment.name.name} {`,
    ...environment.body.flatMap((declaration, index) => {
      const lines = formatDeclaration(declaration).map(
        (line) => `${indent(1)}${line}`
      );
      return index === environment.body.length - 1 ? lines : [...lines, ""];
    }),
    "}"
  ];
}

function formatDeclaration(declaration: TopLevelDeclarationNode): string[] {
  if (declaration.kind === "ImportDeclaration") {
    return [`import ${formatLiteral(declaration.path)}`];
  }

  if (declaration.kind === "LanguageDeclaration") {
    return [`language ${formatLiteral(declaration.version)}`];
  }

  if (declaration.kind === "SiteDeclaration") {
    return [`site ${formatLiteral(declaration.url)}`];
  }

  if (declaration.kind === "VariableDeclaration") {
    return [`let ${declaration.name.name} ${formatLiteral(declaration.value)}`];
  }

  if (declaration.kind === "PolicyDeclaration") {
    return formatPolicy(declaration);
  }

  if (declaration.kind === "RouteGroupDeclaration") {
    return formatRouteGroup(declaration);
  }

  if (declaration.kind === "EnvironmentDeclaration") {
    return formatEnvironment(declaration);
  }

  return formatRoute(declaration);
}

export function formatSearchLintDocument(
  document: SearchLintDocumentNode
): string {
  return `${document.declarations
    .flatMap((declaration, index) => {
      const lines = formatDeclaration(declaration);
      return index === document.declarations.length - 1
        ? lines
        : [...lines, ""];
    })
    .join("\n")}\n`;
}
