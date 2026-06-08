/**
 * Home-dashboard welcome banner — the maroon gradient header that greets the
 * member by first name, mirroring the static portal's `.welcome-banner`.
 *
 * Pure presentational; all copy is computed by the page and passed in.
 */
export function WelcomeBanner({
  firstName,
  message,
}: {
  firstName: string;
  message: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-brand to-brand-600 p-7 text-white md:p-8">
      {/* Decorative gold glow, matching the static portal's ::after flourish. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-24 h-80 w-80 rounded-full bg-accent/15 blur-2xl"
      />
      <h2 className="relative z-10 font-display text-2xl font-semibold">
        Welcome back, <span className="text-accent">{firstName}</span>
      </h2>
      <p className="relative z-10 mt-2 max-w-xl text-sm text-white/70">{message}</p>
    </div>
  );
}
