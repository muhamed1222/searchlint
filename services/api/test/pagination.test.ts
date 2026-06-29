import { describe, expect, it } from "vitest";

import {
  apiPaginationOpenApiContract,
  createApiPage,
  decodeApiPaginationCursor,
  encodeApiPaginationCursor,
  parseApiPagination
} from "../src/index.js";

const options = {
  defaultPageSize: 25,
  maxPageSize: 100,
  sort: "created_at,id"
};

describe("API pagination contract", () => {
  it("applies default page size and decodes matching cursors", () => {
    const cursor = encodeApiPaginationCursor({
      schemaVersion: 1,
      direction: "forward",
      sort: options.sort,
      after: "2026-06-22T00:00:00.000Z/org-1"
    });

    expect(parseApiPagination({ after: cursor }, options)).toEqual({
      first: 25,
      after: {
        schemaVersion: 1,
        direction: "forward",
        sort: options.sort,
        after: "2026-06-22T00:00:00.000Z/org-1"
      }
    });
  });

  it("accepts bounded explicit page sizes", () => {
    expect(parseApiPagination({ first: 1 }, options)).toEqual({ first: 1 });
    expect(parseApiPagination({ first: 100 }, options)).toEqual({
      first: 100
    });
  });

  it("rejects invalid page sizes and cursor tokens", () => {
    expect(() => parseApiPagination({ first: 0 }, options)).toThrow(
      "Pagination first must be an integer from 1 to 100."
    );
    expect(() => parseApiPagination({ first: 101 }, options)).toThrow(
      "Pagination first must be an integer from 1 to 100."
    );
    expect(() => parseApiPagination({ after: "not-base64" }, options)).toThrow(
      "Pagination cursor is not valid."
    );
    const cursor = encodeApiPaginationCursor({
      schemaVersion: 1,
      direction: "forward",
      sort: "other-sort",
      after: "row-1"
    });
    expect(() => decodeApiPaginationCursor(cursor, options.sort)).toThrow(
      "Pagination cursor sort does not match this endpoint."
    );
  });

  it("creates stable page responses with next cursor semantics", () => {
    const page = createApiPage(
      [
        { id: "one", createdAt: "2026-06-22T00:00:00.000Z" },
        { id: "two", createdAt: "2026-06-22T00:00:01.000Z" },
        { id: "three", createdAt: "2026-06-22T00:00:02.000Z" }
      ],
      {
        requestedFirst: 2,
        sort: options.sort,
        cursorFor(item) {
          return `${item.createdAt}/${item.id}`;
        }
      }
    );

    expect(page.items).toEqual([
      { id: "one", createdAt: "2026-06-22T00:00:00.000Z" },
      { id: "two", createdAt: "2026-06-22T00:00:01.000Z" }
    ]);
    expect(page.pageInfo.hasNextPage).toBe(true);
    expect(
      decodeApiPaginationCursor(page.pageInfo.endCursor ?? "", options.sort)
    ).toEqual({
      schemaVersion: 1,
      direction: "forward",
      sort: options.sort,
      after: "2026-06-22T00:00:01.000Z/two"
    });
  });

  it("omits endCursor when the page is complete", () => {
    expect(
      createApiPage([{ id: "one" }], {
        requestedFirst: 2,
        sort: options.sort,
        cursorFor(item) {
          return item.id;
        }
      })
    ).toEqual({
      items: [{ id: "one" }],
      pageInfo: {
        hasNextPage: false
      }
    });
  });

  it("defines reusable OpenAPI pagination components", () => {
    expect(
      apiPaginationOpenApiContract({
        defaultPageSize: 25,
        maxPageSize: 100
      })
    ).toEqual({
      parameters: {
        first: {
          name: "first",
          in: "query",
          required: false,
          schema: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            default: 25
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
    });
  });
});
