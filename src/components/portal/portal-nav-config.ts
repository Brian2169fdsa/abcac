// Grouped sidebar navigation for the member portal, mirroring the static
// portal. Each navigation item is mapped to its real
// Next.js /account/* route.

export type PortalNavItem = {
  label: string;
  href: string;
};

export type PortalNavGroup = {
  /** Section heading shown above the group; omit for the standalone Home link. */
  heading?: string;
  /** Renders a divider/spacer above the group (the static "utility" block). */
  divider?: boolean;
  items: PortalNavItem[];
};

export const PORTAL_NAV: PortalNavGroup[] = [
  {
    items: [{ label: "Home", href: "/account" }],
  },
  {
    heading: "Profile",
    items: [
      { label: "Personal Information", href: "/account/profile" },
      { label: "Employment Information", href: "/account/experience" },
      { label: "Certificate & Wallet Card", href: "/account/certifications" },
      { label: "Other Certifications", href: "/account/experience" },
    ],
  },
  {
    heading: "Certification",
    items: [
      { label: "Digital Forms Center", href: "/account/forms" },
      { label: "Apply for Certification", href: "/account/forms" },
      { label: "Document Upload", href: "/account/documents" },
      { label: "Continuing Education Unit Tracker", href: "/account/ceus" },
      { label: "Certification Renewal", href: "/account/renew" },
      { label: "Certification Sync", href: "/account/certification-sync" },
      { label: "Authorizations: Clinical Supervision", href: "/account/experience" },
    ],
  },
  {
    heading: "Requests",
    items: [
      { label: "Name Change Request", href: "/account/requests" },
      { label: "Verification of Certification", href: "/account/requests" },
      { label: "IC&RC Reciprocity Request", href: "/account/requests" },
    ],
  },
  {
    divider: true,
    items: [
      { label: "Activity", href: "/account/activity" },
      { label: "Messages", href: "/account/messages" },
      { label: "Notifications", href: "/account/notifications" },
      { label: "Invoices & Receipts", href: "/account/invoices" },
      { label: "Account Settings", href: "/account/settings" },
    ],
  },
];
