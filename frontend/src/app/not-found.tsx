import Link from "next/link";
import { siteConfig } from "@/lib/site-config";

export default function NotFound() {
  return (
    <html lang="en">
      <body className="bg-bg text-ink">
        <main className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
          <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted">
            {siteConfig.shortName}
          </p>

          <h1 className="font-display text-5xl font-bold tracking-tight text-brand sm:text-6xl">
            404
          </h1>

          <p className="mt-3 text-xl font-semibold text-ink">Page not found</p>

          <p className="mt-4 max-w-md text-base text-muted">
            The page you&apos;re looking for doesn&apos;t exist or may have been moved.
            If you followed a link, it may be outdated.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Back to Home
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center rounded-lg border border-line px-5 py-2.5 text-sm font-semibold text-ink hover:bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Contact Us
            </Link>
          </div>

          <p className="mt-12 text-xs text-muted">
            {siteConfig.name}
          </p>
        </main>
      </body>
    </html>
  );
}
