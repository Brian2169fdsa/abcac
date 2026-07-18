import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How ABCAC collects, uses, stores, and protects website and member information.",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto w-full max-w-4xl px-5 py-14 sm:px-8 sm:py-16 lg:py-20">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Legal</p>
      <h1 className="mt-3">Privacy Policy</h1>
      <p className="mt-3 text-sm text-muted">Effective July 18, 2026</p>
      <div className="prose prose-slate mt-8 max-w-none prose-headings:text-ink prose-a:text-brand">
        <p>ABCAC collects and processes information needed to operate credentialing, certification, renewal, testing, continuing education, reciprocity, directory, communication, and payment services.</p>
        <h2>Information we collect</h2>
        <p>Information may include contact details, account credentials, certification numbers, application data, education and experience records, supervision details, uploaded documents, communications, payment status, and technical information such as browser, device, IP address, and security logs.</p>
        <h2>How information is used</h2>
        <p>We use information to verify identity and eligibility, review applications, maintain credential records, administer exams and renewals, process requests, send notices, prevent fraud, support users, improve services, and satisfy legal or regulatory obligations.</p>
        <h2>Service providers and disclosures</h2>
        <p>ABCAC may share only the information reasonably necessary with providers that support hosting, authentication, databases, payments, email, testing, document processing, and security. Information may also be disclosed to IC&amp;RC, member boards, testing partners, regulators, law enforcement, or other authorities when required or appropriate for credential verification and public protection.</p>
        <h2>Payments</h2>
        <p>Payments are processed by Stripe. ABCAC does not store complete payment-card numbers in its application database.</p>
        <h2>Retention and security</h2>
        <p>Records are retained as needed for credential administration, audit, dispute resolution, security, and legal obligations. ABCAC uses administrative and technical safeguards, but no internet service can guarantee absolute security.</p>
        <h2>Your choices</h2>
        <p>You may update certain account information through the member portal and may contact ABCAC to request correction of inaccurate records. Some records must be retained to preserve credential history, financial records, public-protection decisions, or legal compliance.</p>
        <h2>Contact</h2>
        <p>Privacy questions may be sent to <a href={siteConfig.contact.emailHref}>{siteConfig.contact.email}</a> or directed to {siteConfig.contact.phone}.</p>
      </div>
    </article>
  );
}
