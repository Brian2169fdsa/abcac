import type { Metadata } from "next";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "Terms governing use of the ABCAC website, member portal, applications, and online services.",
};

export default function TermsPage() {
  return (
    <article className="mx-auto w-full max-w-4xl px-5 py-14 sm:px-8 sm:py-16 lg:py-20">
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand">Legal</p>
      <h1 className="mt-3">Terms of Use</h1>
      <p className="mt-3 text-sm text-muted">Effective July 18, 2026</p>
      <div className="prose prose-slate mt-8 max-w-none prose-headings:text-ink prose-a:text-brand">
        <p>These Terms of Use govern access to the ABCAC website, member portal, application tools, document-upload services, and payment links. By using these services, you agree to these terms and all applicable ABCAC policies.</p>
        <h2>Accurate information</h2>
        <p>You are responsible for providing complete, current, and truthful information. Submission or payment does not guarantee certification, renewal, exam authorization, reciprocity, endorsement, or any other approval.</p>
        <h2>Accounts and security</h2>
        <p>Keep your sign-in credentials confidential and notify ABCAC promptly if you believe your account has been accessed without permission. You may not access another person&apos;s account or misrepresent your identity, credentials, education, supervision, experience, or eligibility.</p>
        <h2>Applications, review, and decisions</h2>
        <p>ABCAC may request additional documentation, verify submitted information, correct administrative errors, and approve, defer, deny, suspend, or revoke services or credentials according to applicable standards and policies.</p>
        <h2>Payments and refunds</h2>
        <p>Fees are charged for the product or service selected at checkout. Unless a published policy states otherwise, processing, examination, review, and administrative fees may be nonrefundable once work has begun or a registration has been submitted.</p>
        <h2>Acceptable use</h2>
        <p>You may not interfere with the website, upload malicious content, attempt unauthorized access, scrape protected information, misuse directory data, or reproduce ABCAC content, logos, certificates, or materials without permission.</p>
        <h2>No professional or legal advice</h2>
        <p>Website content provides general credentialing information. It is not legal, clinical, employment, or licensing advice. Requirements may also be controlled by IC&amp;RC, AZBBHE, another member board, a testing provider, or another authority.</p>
        <h2>Changes and availability</h2>
        <p>ABCAC may update these terms, correct content, change services, or temporarily suspend access for maintenance, security, or operational reasons.</p>
        <h2>Contact</h2>
        <p>Questions may be sent to <a href={siteConfig.contact.emailHref}>{siteConfig.contact.email}</a> or directed to {siteConfig.contact.phone}.</p>
      </div>
    </article>
  );
}
