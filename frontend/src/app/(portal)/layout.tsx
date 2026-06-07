import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PortalNav } from "@/components/portal-nav";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  // Auth is enforced by middleware (redirects unauthenticated users to /login).
  return (
    <>
      <SiteHeader />
      <PortalNav />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
