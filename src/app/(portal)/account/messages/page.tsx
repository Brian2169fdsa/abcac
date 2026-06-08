import { Mail } from "lucide-react";
import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { MessagesPanel } from "@/components/messages-panel";

export const metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

export default function MessagesPage() {
  return (
    <>
      <PageHero eyebrow="Member Portal" title="Messages" intro="Messages and announcements from ABCAC — and send a message back." />
      <Section compact>
        <div className="mb-6 flex items-start gap-4 rounded-xl border border-info/20 bg-info/5 px-5 py-4">
          <Mail className="mt-0.5 h-5 w-5 flex-shrink-0 text-info" aria-hidden />
          <p className="text-sm text-ink">
            Messages from ABCAC staff are marked as read automatically when you open this page. Use the form below to
            reply or start a new conversation — staff typically respond within a few business days.
          </p>
        </div>
        <MessagesPanel />
      </Section>
    </>
  );
}
