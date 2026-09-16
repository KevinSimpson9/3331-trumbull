import type { MetadataRoute } from "next";

/** The portal is private. Nothing here is for a crawler. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
