import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

const defaultTitle = "ABCAC — Arizona Board for Certification of Addiction Counselors";
const defaultDescription =
  "Setting the Standard for Addiction Counselor Certification in Arizona. Initial certification, renewals, IC&RC exams, reciprocity, and CEU endorsement.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: defaultTitle,
    template: "%s | ABCAC",
  },
  description: defaultDescription,
  openGraph: {
    type: "website",
    siteName: "ABCAC",
    title: defaultTitle,
    description: defaultDescription,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
