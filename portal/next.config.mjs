/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // The portal holds investors' executed documents and banking details. These
  // headers apply to every response, including the signed-out sign-in page.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Keep the portal out of search results and AI crawlers, belt and
          // braces with app/robots.ts and the per-page robots metadata.
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" },
          // No framing: blocks clickjacking of the sign-in and document views.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Don't leak a signed-URL path to whatever an investor clicks through to.
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
