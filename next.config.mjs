/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    // Preserve inbound links/bookmarks from the old abcac.org URL scheme.
    return [
      { source: "/contact-us", destination: "/contact", permanent: true },
      { source: "/newpage", destination: "/testing", permanent: true },
      { source: "/initial-or-renewal-of-cert", destination: "/initial-certification", permanent: true },
      { source: "/initial-or-renewal", destination: "/initial-certification", permanent: true },
      { source: "/home", destination: "/", permanent: true },
      { source: "/product/:slug", destination: "/store/:slug", permanent: true },
      // Retire the legacy static portal entry points in favor of the authenticated
      // Next.js member and admin applications.
      { source: "/portal", destination: "/account", permanent: true },
      { source: "/portal/admin", destination: "/admin", permanent: true },
      // The admin console is a separate app at /admin (not nested under
      // /account). Catch the intuitive-but-wrong /account/admin URL so it never
      // 404s — the role gate still applies once you land on /admin.
      { source: "/account/admin", destination: "/admin", permanent: false },
    ];
  },
};

export default nextConfig;
