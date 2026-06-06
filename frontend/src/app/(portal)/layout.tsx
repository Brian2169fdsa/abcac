import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  // Auth is enforced by middleware (redirects unauthenticated users to /login).
  return (
    <>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
