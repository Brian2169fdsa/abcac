import { AnnouncementForm } from "@/components/admin/announcement-form";

export const metadata = { title: "Send Announcement" };
export const dynamic = "force-dynamic";

export default function AdminAnnouncementsPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Send Announcement</h1>
      <p className="mb-6 text-muted">
        Broadcast a message to every member who opted in to the chosen channel. Each recipient gets the
        announcement in their portal Messages inbox, and an email if email delivery is configured. This
        honors the <strong>ABCAC announcements</strong> and <strong>IC&amp;RC updates</strong> preferences
        members set in their account settings.
      </p>
      <AnnouncementForm />
    </>
  );
}
