import { describe, expect, it } from "vitest";

import {
  analyzeNextSourceFiles,
  inferNextRouteFromPath
} from "../src/index.js";

describe("inferNextRouteFromPath", () => {
  it("infers App Router routes deterministically", () => {
    expect(inferNextRouteFromPath("app/page.tsx")).toEqual({
      router: "app",
      route: "/"
    });
    expect(inferNextRouteFromPath("app/products/[slug]/page.tsx")).toEqual({
      router: "app",
      route: "/products/[slug]"
    });
    expect(inferNextRouteFromPath("src/app/(shop)/cart/page.tsx")).toEqual({
      router: "app",
      route: "/cart"
    });
    expect(
      inferNextRouteFromPath("src/app/@modal/(.)photos/[id]/page.tsx")
    ).toEqual({
      router: "app",
      route: "/photos/[id]"
    });
  });

  it("infers Pages Router routes deterministically", () => {
    expect(inferNextRouteFromPath("pages/index.tsx")).toEqual({
      router: "pages",
      route: "/"
    });
    expect(inferNextRouteFromPath("src/pages/products/[slug].tsx")).toEqual({
      router: "pages",
      route: "/products/[slug]"
    });
    expect(inferNextRouteFromPath("pages/api/health.ts")).toBeUndefined();
  });
});

describe("analyzeNextSourceFiles", () => {
  it("finds exact static metadata field locations", () => {
    const result = analyzeNextSourceFiles([
      {
        path: "app/products/[slug]/page.tsx",
        content: `import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Product",
  description: "Product page",
  openGraph: {
    title: "Product"
  }
};

export default function Page() {
  return null;
}
`
      }
    ]);

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "static-metadata-object",
          location: {
            confidence: "EXACT",
            file: "app/products/[slug]/page.tsx",
            line: 3
          }
        }),
        expect.objectContaining({
          kind: "static-metadata-field",
          field: "title",
          location: {
            confidence: "EXACT",
            file: "app/products/[slug]/page.tsx",
            line: 4
          }
        }),
        expect.objectContaining({
          kind: "static-metadata-field",
          field: "description",
          location: {
            confidence: "EXACT",
            file: "app/products/[slug]/page.tsx",
            line: 5
          }
        }),
        expect.objectContaining({
          kind: "static-metadata-field",
          field: "openGraph",
          location: {
            confidence: "EXACT",
            file: "app/products/[slug]/page.tsx",
            line: 6
          }
        })
      ])
    );
  });

  it("finds generateMetadata as related without fabricated line precision", () => {
    const result = analyzeNextSourceFiles([
      {
        path: "app/blog/[slug]/page.tsx",
        content: `export async function generateMetadata() {
  return {
    title: await loadTitle()
  };
}
`
      }
    ]);

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "generate-metadata",
          exportName: "generateMetadata",
          location: {
            confidence: "RELATED",
            file: "app/blog/[slug]/page.tsx"
          }
        })
      ])
    );
    expect(
      result.findings.find((finding) => finding.kind === "generate-metadata")
        ?.location.line
    ).toBeUndefined();
  });

  it("finds Pages Router next/head usage with exact route evidence", () => {
    const result = analyzeNextSourceFiles([
      {
        path: "pages/products/[slug].tsx",
        content: `import Head from "next/head";

export default function Page() {
  return (
    <Head>
      <title>Product</title>
    </Head>
  );
}
`
      },
      {
        path: "app/products/[slug]/page.tsx",
        content: `import Head from "next/head";

export default function Page() {
  return <Head />;
}
`
      }
    ]);

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        kind: "pages-head",
        router: "pages",
        route: "/products/[slug]",
        exportName: "Head",
        location: {
          confidence: "EXACT",
          file: "pages/products/[slug].tsx",
          line: 5
        }
      })
    );
    expect(
      result.findings.filter((finding) => finding.kind === "pages-head")
    ).toHaveLength(1);
  });

  it("finds route and special file signals", () => {
    const result = analyzeNextSourceFiles([
      {
        path: "app/products/[slug]/page.tsx",
        content: "export default function Page() { return null; }"
      },
      {
        path: "app/robots.ts",
        content: "export default function robots() { return {}; }"
      },
      {
        path: "app/sitemap.ts",
        content: "export default function sitemap() { return []; }"
      },
      {
        path: "app/opengraph-image.tsx",
        content: "export default function Image() { return null; }"
      },
      {
        path: "app/products/[slug]/twitter-image.tsx",
        content: "export default function Image() { return null; }"
      },
      {
        path: "middleware.ts",
        content: "export function middleware() { return Response.next(); }"
      },
      {
        path: "src/proxy.ts",
        content: "export function proxy() { return Response.next(); }"
      }
    ]);

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "next-route",
          router: "app",
          route: "/products/[slug]",
          location: {
            confidence: "EXACT",
            file: "app/products/[slug]/page.tsx",
            line: 1
          }
        }),
        expect.objectContaining({
          kind: "robots-file",
          exportName: "robots",
          location: {
            confidence: "EXACT",
            file: "app/robots.ts",
            line: 1
          }
        }),
        expect.objectContaining({
          kind: "sitemap-file",
          exportName: "sitemap",
          location: {
            confidence: "EXACT",
            file: "app/sitemap.ts",
            line: 1
          }
        }),
        expect.objectContaining({
          kind: "opengraph-image-file",
          exportName: "opengraph-image",
          location: {
            confidence: "EXACT",
            file: "app/opengraph-image.tsx",
            line: 1
          }
        }),
        expect.objectContaining({
          kind: "twitter-image-file",
          exportName: "twitter-image",
          router: "app",
          route: "/products/[slug]",
          location: {
            confidence: "EXACT",
            file: "app/products/[slug]/twitter-image.tsx",
            line: 1
          }
        }),
        expect.objectContaining({
          kind: "middleware-file",
          exportName: "middleware",
          location: {
            confidence: "EXACT",
            file: "middleware.ts",
            line: 1
          }
        }),
        expect.objectContaining({
          kind: "proxy-file",
          exportName: "proxy",
          location: {
            confidence: "EXACT",
            file: "src/proxy.ts",
            line: 1
          }
        })
      ])
    );
  });

  it("finds exact unoptimized Next image usage in route files", () => {
    const result = analyzeNextSourceFiles([
      {
        path: "app/products/[slug]/page.tsx",
        content: `import Image from "next/image";

export default function Page() {
  return <Image src="/p.png" alt="Product" width={1200} height={630} unoptimized />;
}
`
      },
      {
        path: "app/blog/[slug]/page.tsx",
        content: `import Image from "next/image";

export default function Page() {
  return <Image src="/p.png" alt="Product" width={1200} height={630} unoptimized={false} />;
}
`
      }
    ]);

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        kind: "next-image-unoptimized",
        router: "app",
        route: "/products/[slug]",
        location: {
          confidence: "EXACT",
          file: "app/products/[slug]/page.tsx",
          line: 4
        }
      })
    );
    expect(
      result.findings.filter(
        (finding) => finding.kind === "next-image-unoptimized"
      )
    ).toHaveLength(1);
  });

  it("finds generateSitemaps as a related source signal", () => {
    const result = analyzeNextSourceFiles([
      {
        path: "app/sitemap.ts",
        content: `export async function generateSitemaps() {
  return [{ id: 0 }];
}

export default function sitemap() {
  return [];
}
`
      }
    ]);

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "sitemap-file",
          exportName: "sitemap",
          location: {
            confidence: "EXACT",
            file: "app/sitemap.ts",
            line: 1
          }
        }),
        expect.objectContaining({
          kind: "generate-sitemaps",
          exportName: "generateSitemaps",
          location: {
            confidence: "RELATED",
            file: "app/sitemap.ts"
          }
        })
      ])
    );
    expect(
      result.findings.find((finding) => finding.kind === "generate-sitemaps")
        ?.location.line
    ).toBeUndefined();
  });

  it("finds generateStaticParams as a related route source signal", () => {
    const result = analyzeNextSourceFiles([
      {
        path: "app/products/[slug]/page.tsx",
        content: `export async function generateStaticParams() {
  return [{ slug: "one" }];
}

export default function Page() {
  return null;
}
`
      }
    ]);

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "next-route",
          router: "app",
          route: "/products/[slug]"
        }),
        expect.objectContaining({
          kind: "generate-static-params",
          exportName: "generateStaticParams",
          location: {
            confidence: "RELATED",
            file: "app/products/[slug]/page.tsx"
          }
        })
      ])
    );
    expect(
      result.findings.find(
        (finding) => finding.kind === "generate-static-params"
      )?.location.line
    ).toBeUndefined();
  });

  it("finds Next config redirects and rewrites as related source signals", () => {
    const result = analyzeNextSourceFiles([
      {
        path: "next.config.mjs",
        content: `const nextConfig = {
  async redirects() {
    return [
      { source: "/old", destination: "/new", permanent: true },
      { source: "/legacy/:slug", destination: "/blog/:slug", permanent: false }
    ];
  },
  rewrites: async () => [
    { source: "/proxy/:path*", destination: "https://example.com/:path*" }
  ]
};

export default nextConfig;
`
      }
    ]);

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "next-config-redirects",
          exportName: "redirects",
          configRouteEntries: [
            {
              source: "/old",
              destination: "/new",
              permanent: true
            },
            {
              source: "/legacy/:slug",
              destination: "/blog/:slug",
              permanent: false
            }
          ],
          location: {
            confidence: "RELATED",
            file: "next.config.mjs"
          }
        }),
        expect.objectContaining({
          kind: "next-config-rewrites",
          exportName: "rewrites",
          configRouteEntries: [
            {
              source: "/proxy/:path*",
              destination: "https://example.com/:path*"
            }
          ],
          location: {
            confidence: "RELATED",
            file: "next.config.mjs"
          }
        })
      ])
    );
    expect(
      result.findings.find(
        (finding) => finding.kind === "next-config-redirects"
      )?.location.line
    ).toBeUndefined();
  });
});
