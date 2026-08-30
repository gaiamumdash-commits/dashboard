import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "gaiamum.com.br" }],
        destination: "https://www.gaiamum.com.br/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
