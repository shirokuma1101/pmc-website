import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const directusUrl = process.env.DIRECTUS_URL ?? "http://localhost:8055";
const directus = new URL(directusUrl);

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: fileURLToPath(new URL(".", import.meta.url)),
  },
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: directus.protocol.replace(":", "") as "http" | "https",
        hostname: directus.hostname,
        port: directus.port,
        pathname: "/pmc-website/assets/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-Frame-Options", value: "DENY" }
        ],
      },
    ];
  },
};

export default nextConfig;
