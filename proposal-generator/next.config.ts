import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "utfs.io",
        pathname: "/f/**",
      },
      {
        protocol: "https",
        hostname: "*.uploadthing.com",
      },
      {
        protocol: "https",
        hostname: "files.commonsku.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.commonsku.com",
      },
      {
        protocol: "https",
        hostname: "*.fourthwall.com",
      },
      {
        protocol: "https",
        hostname: "cdn.fourthwall.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
