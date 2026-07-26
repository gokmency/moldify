import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["manifold-3d"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
