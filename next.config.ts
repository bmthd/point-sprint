import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    reactCompiler: true,
    typedEnv: true,
    // typedRoutes: true,
  },
};

export default nextConfig;
