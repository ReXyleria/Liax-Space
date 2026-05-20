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
    middlewareClientMaxBodySize: "512mb",
    serverActions: {
      bodySizeLimit: "5mb"
    }
  }
};

export default nextConfig;
