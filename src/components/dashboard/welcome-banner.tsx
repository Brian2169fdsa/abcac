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
      {/* Decorative light glow, matching the static portal's ::after flourish. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-24 h-80 w-80 rounded-full bg-white/10 blur-2xl"
      />
      <h2 className="relative z-10 font-display text-2xl font-semibold text-white">
        Welcome back, <span className="underline decoration-white/40 underline-offset-4">{firstName}</span>
      </h2>
      <p className="relative z-10 mt-2 max-w-xl text-sm text-white/85">{message}</p>
    </div>
  );
}
