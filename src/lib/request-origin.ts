// Resolve the site origin for redirect URLs (Stripe success/cancel, billing
// portal returns) from the incoming request rather than only the
// NEXT_PUBLIC_SITE_URL env var. This keeps post-payment redirects on the SAME
// host the buyer is using — critical while the production env var points at a
// domain that has not been cut over yet, and it makes preview deployments
// return to themselves. Vercel sets x-forwarded-host/-proto on every request;
// they identify the deployment host and are not client-forgeable at the edge.

export function requestOrigin(req: Request): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
