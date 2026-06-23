import type { PageSnapshot, RouteContract } from "./types.js";

export function sourceRouteApplies(
  sourceRoute: string | undefined,
  currentRoute: string | undefined
): boolean {
  if (sourceRoute === undefined) {
    return true;
  }
  if (currentRoute === undefined) {
    return false;
  }

  return routesAreCompatible(sourceRoute, currentRoute);
}

export function routesAreCompatible(left: string, right: string): boolean {
  return routePatternMatches(left, right) || routePatternMatches(right, left);
}

export function resolveRouteContract(
  snapshot: PageSnapshot,
  routeContracts: readonly RouteContract[]
): RouteContract | undefined {
  const snapshotRoute = snapshot.route;
  if (!snapshotRoute) {
    return undefined;
  }

  return routeContracts
    .filter((contract) => routesAreCompatible(contract.route, snapshotRoute))
    .sort(compareRouteContractSpecificity)[0];
}

function compareRouteContractSpecificity(
  left: RouteContract,
  right: RouteContract
): number {
  const leftScore = routeSpecificityScore(left.route);
  const rightScore = routeSpecificityScore(right.route);

  if (leftScore.literalSegments !== rightScore.literalSegments) {
    return rightScore.literalSegments - leftScore.literalSegments;
  }
  if (leftScore.totalSegments !== rightScore.totalSegments) {
    return rightScore.totalSegments - leftScore.totalSegments;
  }

  return left.route.localeCompare(right.route);
}

function routeSpecificityScore(route: string): {
  literalSegments: number;
  totalSegments: number;
} {
  const segments = routeSegments(route);
  return {
    literalSegments: segments.filter((segment) => !isPatternSegment(segment))
      .length,
    totalSegments: segments.length
  };
}

function routePatternMatches(pattern: string, candidate: string): boolean {
  return routeSegmentsMatch(routeSegments(pattern), routeSegments(candidate));
}

function routeSegments(path: string): readonly string[] {
  const normalized =
    path === "/" ? "/" : path.replace(/\/+/g, "/").replace(/\/$/, "");
  return normalized.split("/").filter(Boolean);
}

function routeSegmentsMatch(
  patternSegments: readonly string[],
  candidateSegments: readonly string[]
): boolean {
  if (patternSegments.length === 0) {
    return candidateSegments.length === 0;
  }

  const [patternHead, ...patternTail] = patternSegments;
  if (patternHead === "**" || isNextCatchAllSegment(patternHead)) {
    if (routeSegmentsMatch(patternTail, candidateSegments)) {
      return true;
    }

    return (
      candidateSegments.length > 0 &&
      routeSegmentsMatch(patternSegments, candidateSegments.slice(1))
    );
  }

  if (candidateSegments.length === 0) {
    return false;
  }

  if (
    patternHead === "*" ||
    isNextDynamicSegment(patternHead) ||
    patternHead === candidateSegments[0]
  ) {
    return routeSegmentsMatch(patternTail, candidateSegments.slice(1));
  }

  return false;
}

function isPatternSegment(segment: string): boolean {
  return (
    segment === "*" ||
    segment === "**" ||
    isNextDynamicSegment(segment) ||
    isNextCatchAllSegment(segment)
  );
}

function isNextDynamicSegment(segment: string | undefined): boolean {
  return segment !== undefined && /^\[[^.[\]]+\]$/.test(segment);
}

function isNextCatchAllSegment(segment: string | undefined): boolean {
  return segment !== undefined && /^\[\[?\.{3}[^.\]]+\]?\]$/.test(segment);
}
