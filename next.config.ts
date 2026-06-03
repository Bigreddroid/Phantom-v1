import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // agent-twitter-client pulls in @roamhq/wrtc (native WebRTC binary).
  // Turbopack can't bundle native .node files — mark these as external so
  // Next.js resolves them from node_modules at runtime instead of bundling.
  serverExternalPackages: [
    "agent-twitter-client",
    "@roamhq/wrtc",
    "@roamhq/wrtc-linux-x64",
    "@the-convocation/twitter-scraper",
  ],
  // Bundle public/templates into serverless functions so fs.readFileSync works on Vercel.
  // Note: top-level in Next.js 16, not under experimental.
  outputFileTracingIncludes: {
    "**": ["./public/templates/**"],
  },
};

export default nextConfig;
