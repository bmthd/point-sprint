import type { NextConfig } from "next";

export default {
  compiler: { emotion: true },
  reactStrictMode: true,
  /* config options here */
  experimental: {
    reactCompiler: true,
    typedEnv: true,
    // typedRoutes: true,
  },
} satisfies NextConfig;
