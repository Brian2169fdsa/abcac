/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Serve the co-hosted static member portal under clean URLs.
    return [
      { source: "/portal", destination: "/portal/index.html" },
      { source: "/portal/admin", destination: "/portal/admin.html" },
    ];
  },
};

export default nextConfig;
