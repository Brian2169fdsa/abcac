import Link from "next/link";
import { Section } from "@/components/section";
import { PageHero } from "@/components/page-hero";
import { ActivityTimeline } from "@/components/activity-timeline";
import { buildActivityFeed, activityMeta } from "@/lib/activity";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  assembleSources,
  parseActivityType,
  ACTIVITY_TYPES,
} from "@/lib/account-activity";

export const metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

export default async function AccountActivityPage({
  searchParams,
}: {
  searchParams?: { type?: string | string[] };
}) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user!.id;

  const [
    { data: applications },
    { data: certifications },
    { data: payments },
    { data: invoices },
    { data: ceuRecords },
    { data: documents },
    { data: documentRequests },
    { data: messages },
    { data: nameChangeRequests },
    { data: reciprocityRequests },
  ] = await Promise.all([
    supabase.from("applications").select("*").eq("member_id", uid),
    supabase.from("certifications").select("*").eq("member_id", uid),
    supabase.from("payments").select("*").eq("member_id", uid),
    supabase.from("invoices").select("*").eq("member_id", uid),
    supabase.from("ceu_records").select("*").eq("member_id", uid),
    supabase.from("documents").select("*").eq("member_id", uid),
    supabase.from("document_requests").select("*").eq("member_id", uid),
    supabase.from("messages").select("*").eq("member_id", uid),
    supabase.from("name_change_requests").select("*").eq("member_id", uid),
    supabase.from("reciprocity_requests").select("*").eq("member_id", uid),
  ]);

  const sources = assembleSources({
    applications,
    certifications,
    payments,
    invoices,
    ceuRecords,
    documents,
    documentRequests,
    messages,
    nameChangeRequests,
    reciprocityRequests,
  });

  const activeType = parseActivityType(searchParams?.type);
  const feed = buildActivityFeed(sources);
  const events = activeType ? feed.filter((e) => e.type === activeType) : feed;

  return (
    <>
      <PageHero
        eyebrow="Member Portal"
        title="Activity"
        intro="Your full ABCAC history — applications, payments, credentials, and more."
      />
      <Section compact>
        {/* Type filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            href="/account/activity"
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              activeType === null
                ? "border-brand bg-brand/10 text-brand"
                : "border-line text-muted hover:border-brand/50"
            }`}
          >
            All
          </Link>
          {ACTIVITY_TYPES.map((t) => (
            <Link
              key={t}
              href={`/account/activity?type=${t}`}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                activeType === t
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-line text-muted hover:border-brand/50"
              }`}
            >
              {activityMeta(t).label}
            </Link>
          ))}
        </div>

        <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
          <ActivityTimeline
            events={events}
            linkable
            emptyText={
              activeType
                ? "No activity of this type yet."
                : "No activity yet."
            }
          />
        </div>
      </Section>
    </>
  );
}
