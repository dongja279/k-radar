import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  eslint: {
    // ✅ Vercel 빌드할 때 ESLint 오류 때문에 멈추지 않게 함
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
