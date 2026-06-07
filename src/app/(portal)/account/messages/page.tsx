import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { MessagesPanel } from "@/components/messages-panel";

export const metadata = { title: "Messages" };
export const dynamic = "force-dynamic";

export default function MessagesPage() {
  return (
    <>
      <PageHero eyebrow="Member Portal" title="Messages" intro="Messages and announcements from ABCAC." />
      <Section compact>
        <MessagesPanel />
      </Section>
    </>
  );
}
