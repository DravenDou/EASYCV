import type { NextConfig } from "next";

const rendercvInternalApiBaseUrl =
  process.env.RENDERCV_INTERNAL_API_BASE_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    return [
      {
        source: "/rendercv-api/:path*",
        destination: `${rendercvInternalApiBaseUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
