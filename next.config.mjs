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
  async redirects() {
    // Preserve inbound links/bookmarks from the old abcac.org URL scheme.
    return [
      { source: "/contact-us", destination: "/contact", permanent: true },
      { source: "/newpage", destination: "/testing", permanent: true },
      { source: "/initial-or-renewal-of-cert", destination: "/initial-or-renewal", permanent: true },
      { source: "/home", destination: "/", permanent: true },
      { source: "/product/:slug", destination: "/store/:slug", permanent: true },
      // The admin console is a separate app at /admin (not nested under
      // /account). Catch the intuitive-but-wrong /account/admin URL so it never
      // 404s — the role gate still applies once you land on /admin.
      { source: "/account/admin", destination: "/admin", permanent: false },
    ];
  },
};

export default nextConfig;
