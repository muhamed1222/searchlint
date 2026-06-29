export type ApiPaginationDirection = "forward";

export type ApiPaginationCursorPayload = {
  schemaVersion: 1;
  direction: ApiPaginationDirection;
  sort: string;
  after: string;
};

export type ApiPaginationInput = {
  first?: number;
  after?: string;
};

export type ApiPaginationOptions = {
  defaultPageSize: number;
  maxPageSize: number;
  sort: string;
};

export type ApiPaginationRequest = {
  first: number;
  after?: ApiPaginationCursorPayload;
};

export type ApiPageInfo = {
  hasNextPage: boolean;
  endCursor?: string;
};

export type ApiPage<T> = {
  items: readonly T[];
  pageInfo: ApiPageInfo;
};

export type ApiPaginationOpenApiContract = {
  parameters: {
    first: {
      name: "first";
      in: "query";
      required: false;
      schema: {
        type: "integer";
        minimum: 1;
        maximum: number;
        default: number;
      };
    };
    after: {
      name: "after";
      in: "query";
      required: false;
      schema: {
        type: "string";
        minLength: 1;
      };
    };
  };
  pageInfoSchema: {
    type: "object";
    required: readonly ["hasNextPage"];
    properties: {
      hasNextPage: { type: "boolean" };
      endCursor: { type: "string" };
    };
  };
};

export function parseApiPagination(
  input: ApiPaginationInput,
  options: ApiPaginationOptions
): ApiPaginationRequest {
  validateOptions(options);
  const first = input.first ?? options.defaultPageSize;
  if (!Number.isInteger(first) || first < 1 || first > options.maxPageSize) {
    throw new Error(
      `Pagination first must be an integer from 1 to ${options.maxPageSize}.`
    );
  }
  const after =
    input.after === undefined
      ? undefined
      : decodeApiPaginationCursor(input.after, options.sort);
  return {
    first,
    ...(after === undefined ? {} : { after })
  };
}

export function encodeApiPaginationCursor(
  payload: ApiPaginationCursorPayload
): string {
  if (payload.schemaVersion !== 1) {
    throw new Error("Pagination cursor schemaVersion must be 1.");
  }
  if (payload.direction !== "forward") {
    throw new Error("Pagination cursor direction must be forward.");
  }
  if (payload.sort.trim().length === 0) {
    throw new Error("Pagination cursor sort is required.");
  }
  if (payload.after.trim().length === 0) {
    throw new Error("Pagination cursor after value is required.");
  }
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeApiPaginationCursor(
  cursor: string,
  expectedSort: string
): ApiPaginationCursorPayload {
  if (cursor.trim().length === 0) {
    throw new Error("Pagination cursor must not be empty.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new Error("Pagination cursor is not valid.");
  }
  if (!isRecord(parsed)) {
    throw new Error("Pagination cursor payload must be an object.");
  }
  const payload = parsed as Record<string, unknown>;
  if (payload.schemaVersion !== 1) {
    throw new Error("Pagination cursor schemaVersion is unsupported.");
  }
  if (payload.direction !== "forward") {
    throw new Error("Pagination cursor direction is unsupported.");
  }
  if (payload.sort !== expectedSort) {
    throw new Error("Pagination cursor sort does not match this endpoint.");
  }
  if (typeof payload.after !== "string" || payload.after.trim().length === 0) {
    throw new Error("Pagination cursor after value is invalid.");
  }
  return {
    schemaVersion: 1,
    direction: "forward",
    sort: expectedSort,
    after: payload.after
  };
}

export function createApiPage<T>(
  rows: readonly T[],
  options: {
    requestedFirst: number;
    sort: string;
    cursorFor(item: T): string;
  }
): ApiPage<T> {
  if (!Number.isInteger(options.requestedFirst) || options.requestedFirst < 1) {
    throw new Error("Pagination requestedFirst must be positive.");
  }
  const hasNextPage = rows.length > options.requestedFirst;
  const items = hasNextPage ? rows.slice(0, options.requestedFirst) : rows;
  const last = items.at(-1);
  return {
    items,
    pageInfo: {
      hasNextPage,
      ...(hasNextPage && last !== undefined
        ? {
            endCursor: encodeApiPaginationCursor({
              schemaVersion: 1,
              direction: "forward",
              sort: options.sort,
              after: options.cursorFor(last)
            })
          }
        : {})
    }
  };
}

export function apiPaginationOpenApiContract(options: {
  defaultPageSize: number;
  maxPageSize: number;
}): ApiPaginationOpenApiContract {
  validatePageSizeOptions(options.defaultPageSize, options.maxPageSize);
  return {
    parameters: {
      first: {
        name: "first",
        in: "query",
        required: false,
        schema: {
          type: "integer",
          minimum: 1,
          maximum: options.maxPageSize,
          default: options.defaultPageSize
        }
      },
      after: {
        name: "after",
        in: "query",
        required: false,
        schema: {
          type: "string",
          minLength: 1
        }
      }
    },
    pageInfoSchema: {
      type: "object",
      required: ["hasNextPage"],
      properties: {
        hasNextPage: { type: "boolean" },
        endCursor: { type: "string" }
      }
    }
  };
}

function validateOptions(options: ApiPaginationOptions): void {
  validatePageSizeOptions(options.defaultPageSize, options.maxPageSize);
  if (options.sort.trim().length === 0) {
    throw new Error("Pagination sort is required.");
  }
}

function validatePageSizeOptions(
  defaultPageSize: number,
  maxPageSize: number
): void {
  if (!Number.isInteger(defaultPageSize) || defaultPageSize < 1) {
    throw new Error("Pagination default page size must be positive.");
  }
  if (!Number.isInteger(maxPageSize) || maxPageSize < defaultPageSize) {
    throw new Error("Pagination max page size must be >= default page size.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
