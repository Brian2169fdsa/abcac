import Link from "next/link";
import { requireUserId } from "@/lib/auth/current-user";
import { CertificationHub } from "@/components/certification-hub";
import { PageHero } from "@/components/page-hero";
import { Section } from "@/components/section";

export const metadata = { title: "Certification" };
export const dynamic = "force-dynamic";

// The single Certification tab: choose Initial or Recertification, pick the
// credential, and the digital application flow opens. Everything certification
// lives behind this one entry point.
export default async function CertificationPage() {
  await requireUserId();
  return (
    <>
      <PageHero
        eyebrow="Member Portal"
        title="Certification"
        intro="Start or renew an ABCAC credential. Choose your path below — your application, signatures, documents, payment, and status all stay together in your account."
      />
      <Section compact>
        <CertificationHub />
        <p className="mt-8 text-sm text-muted">
          Looking for something else? <Link href="/account/testing" className="font-semibold text-brand">Exam registration</Link>,{" "}
          <Link href="/account/certification-sync" className="font-semibold text-brand">certification sync</Link>,{" "}
          <Link href="/account/ceus" className="font-semibold text-brand">CEU tracker</Link>, or{" "}
          <Link href="/account/certifications" className="font-semibold text-brand">your issued certificates</Link>.
        </p>
      </Section>
    </>
  );
}
