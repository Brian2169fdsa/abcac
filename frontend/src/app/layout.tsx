import type { Metadata } from "next";
import { Sora, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sora",
  weight: ["400", "600", "700"],
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "ABCAC — Arizona Board for Certification of Addiction Counselors",
    template: "%s | ABCAC",
  },
  description:
    "Setting the Standard for Addiction Counselor Certification in Arizona. Initial certification, renewals, IC&RC exams, reciprocity, and CEU endorsement.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${sourceSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
