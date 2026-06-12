import type { ReactNode } from "react";

/**
 * Sign-out control: a POST form to /logout styled like a link/button.
 * NEVER render sign-out as <Link href="/logout"> — Next.js prefetches links,
 * and a prefetched GET used to revoke the session in the background (the
 * "logged out on every tab switch" bug). POST is not prefetchable.
 */
export function SignOutButton({
  className,
  children = "Sign Out",
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <form action="/logout" method="post" className="contents">
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}
