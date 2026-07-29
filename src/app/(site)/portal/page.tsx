import type { Metadata } from "next";
import { ArrowRight, CheckCircle2, FileSignature, ReceiptText, ShieldCheck } from "lucide-react";
import { authHref, safeInternalPath } from "@/lib/portal-routing";
import { CtaButton } from "@/components/cta-button";

export const metadata: Metadata = {
  title: "Member Portal",
  description: "Sign in or create an ABCAC account to complete forms, make linked payments, and track certification and testing work.",
  robots: { index: false, follow: false },
};

const benefits = [
  { icon: FileSignature, title: "Save and finish later", body: "Complete ABCAC forms online, invite required signers, or upload the original paper packet." },
  { icon: ReceiptText, title: "Keep payments connected", body: "Stripe payments, receipts, applications, testing registrations, and service requests stay attached to your account." },
  { icon: CheckCircle2, title: "Track every next step", body: "See what ABCAC received, what still needs attention, and when staff completes an administrative action." },
];

export default function PortalGatewayPage({ searchParams }: { searchParams?: { next?: string } }) {
  const next = safeInternalPath(searchParams?.next);

  return (
    <main className="bg-bg">
      <section className="border-b border-line bg-gradient-to-br from-info via-info to-ink text-white">
        <div className="mx-auto grid w-full max-w-content gap-10 px-5 py-16 md:px-8 md:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em]">
              <ShieldCheck className="h-4 w-4" aria-hidden /> Secure ABCAC workflow
            </span>
            <h1 className="mt-6 max-w-[13ch] text-white">Manage your certification work in one place.</h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/75">
              Create an account or sign in before submitting forms or paying. This keeps every application, exam registration, request, receipt, and staff update connected to you.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <CtaButton href={authHref("signup", next)} size="lg" className="justify-center bg-brand hover:bg-brand-600">
                Create an account <ArrowRight className="h-4 w-4" aria-hidden />
              </CtaButton>
              <CtaButton href={authHref("login", next)} variant="outline" size="lg" className="justify-center border-white/35 bg-white text-ink hover:bg-white/90">
                Sign in
              </CtaButton>
            </div>
            <p className="mt-4 text-sm text-white/60">You will return directly to the service or form you selected.</p>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/10 p-5 shadow-2xl shadow-black/15 backdrop-blur sm:p-7">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white/60">What your account unlocks</p>
            <div className="mt-5 space-y-4">
              {benefits.map(({ icon: Icon, title, body }) => (
                <div key={title} className="flex gap-4 rounded-2xl border border-white/10 bg-white/10 p-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <h2 className="text-lg text-white">{title}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-white/65">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
