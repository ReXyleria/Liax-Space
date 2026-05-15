/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/uploads/:path*",
          destination: "/api/runtime-uploads/:path*"
        }
      ]
    };
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb"
    }
  }
};

export default nextConfig;
