import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Bundle public/templates into serverless functions so fs.readFileSync works on Vercel
    outputFileTracingIncludes: {
      "**": ["./public/templates/**"],
    },
  },
};

export default nextConfig;
