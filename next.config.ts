import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdf-parse"],
  env: {
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV,
  },
  async redirects() {
    return [
      {
        source: "/market",
        destination: "/dashboard",
        permanent: false,
      },
      {
        source: "/market/:path*",
        destination: "/dashboard",
        permanent: false,
      },
    ];
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
