// Single source of truth for organization details.
// Used by the footer, the /contact page, and Stripe receipts.
// (Assumed-current contact set per build instructions; see DECISIONS.md.)

export const siteConfig = {
  name: "Arizona Board for Certification of Addiction Counselors",
  shortName: "ABCAC",
  tagline: "Setting the Standard for Addiction Counselor Certification in Arizona.",
  trustLine: "Trusted by 1,000+ certified addictions counselors",
  contact: {
    org: "ABCAC",
    addressLine: "PO Box 83165",
    cityStateZip: "Phoenix, AZ 85071",
    phone: "480-980-1770",
    phoneHref: "tel:+14809801770",
    email: "abcac@abcac.org",
    emailHref: "mailto:abcac@abcac.org",
  },
  icrcLine:
    "ABCAC is an independent member board of the International Certification & Reciprocity Consortium (IC&RC).",
  legal:
    "© 2026 Arizona Board for Certification of Addiction Counselors (ABCAC). All rights reserved. Unauthorized use of content, logos, or materials is strictly prohibited.",
} as const;

export type SiteConfig = typeof siteConfig;
