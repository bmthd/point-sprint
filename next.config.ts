import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: { emotion: true },
  reactStrictMode: true,
  /* config options here */
  experimental: {
    reactCompiler: true,
    typedEnv: true,
    // typedRoutes: true,
  },
};

export default nextConfig;
