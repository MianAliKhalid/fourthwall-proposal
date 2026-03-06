import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      // Block all old routes - redirect to homepage
      { source: '/login', destination: '/', permanent: true },
      { source: '/dashboard', destination: '/', permanent: true },
      { source: '/documents', destination: '/', permanent: true },
      { source: '/documents/:path*', destination: '/', permanent: true },
      { source: '/folders', destination: '/', permanent: true },
      { source: '/folders/:path*', destination: '/', permanent: true },
      { source: '/new-proposal', destination: '/', permanent: true },
      { source: '/share-links', destination: '/', permanent: true },
      { source: '/admin', destination: '/', permanent: true },
      { source: '/admin/:path*', destination: '/', permanent: true },
    ]
  },
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
