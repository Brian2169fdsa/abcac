"use server";

import { revalidatePath } from "next/cache";
import { isAdminRole } from "@/lib/auth/roles";
import { sendEmail } from "@/lib/email";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

type TestingDecision = "processing" | "pre_registered" | "on_hold" | "cancelled";
type Result = { ok: true } | { ok: false; error: string };

async function adminIdentity() {
  const sb = createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: profile } = await sb.from("profiles").select("portal_role").eq("id", user.id).maybeSingle();
  return isAdminRole(profile?.portal_role) ? user.id : null;
}

export async function updateTestingRequest(id: string, status: TestingDecision, smtCandidateId: string, note: string): Promise<Result> {
  const adminId = await adminIdentity();
  if (!adminId) return { ok: false, error: "Not authorized." };
  if (!id || !["processing", "pre_registered", "on_hold", "cancelled"].includes(status)) return { ok: false, error: "Invalid request." };
  if (status === "pre_registered" && !smtCandidateId.trim()) return { ok: false, error: "Enter the SMT candidate or registration reference." };

  const admin = createSupabaseAdminClient();
  const { data: request } = await admin.from("testing_requests").select("*").eq("id", id).maybeSingle();
  if (!request) return { ok: false, error: "Testing request not found." };

  const patch: Record<string, unknown> = { status, admin_notes: note.trim() || null };
  if (smtCandidateId.trim()) patch.smt_candidate_id = smtCandidateId.trim();
  if (status === "pre_registered") patch.preregistered_at = new Date().toISOString();
  const { error } = await admin.from("testing_requests").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };

  const statusContent = status === "pre_registered"
    ? {
        title: "Your exam pre-registration is complete",
        body: "ABCAC completed your pre-registration with Schroeder Measurement Technologies (SMT). Watch for an SMT email with instructions to continue registration and schedule your exam.",
        subject: "ABCAC completed your IC&RC exam pre-registration",
      }
    : status === "on_hold"
      ? { title: "Your exam registration needs more information", body: note.trim() || "ABCAC needs additional information before completing your SMT pre-registration.", subject: "Update needed for your ABCAC exam registration" }
      : status === "processing"
        ? { title: "ABCAC started your exam pre-registration", body: "Your paid request is now being processed by the ABCAC testing team.", subject: "Your ABCAC exam registration is being processed" }
        : { title: "Your exam registration was cancelled", body: note.trim() || "Your ABCAC exam registration request was cancelled.", subject: "ABCAC exam registration update" };

  await Promise.all([
    admin.from("notifications").insert({ member_id: request.member_id, category: "application", title: statusContent.title, body: statusContent.body, link: "/account/testing" }),
    admin.from("messages").insert({ member_id: request.member_id, from_name: "ABCAC Testing Team", sender_role: "admin", subject: statusContent.title, body: statusContent.body }),
  ]);

  if (status === "pre_registered") {
    await admin.from("member_tasks").update({ status: "done" }).eq("member_id", request.member_id).eq("title", `Pre-register ${request.exam_code} exam candidate with SMT`).in("status", ["open", "in_progress"]);
  }

  const portalUrl = `${(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "")}/account/testing`;
  await sendEmail({
    to: request.tester_email || request.purchaser_email,
    subject: statusContent.subject,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#13233b"><h2 style="color:#861f24">${escapeHtml(statusContent.title)}</h2><p>Hi ${escapeHtml(request.tester_first_name || request.purchaser_first_name)},</p><p>${escapeHtml(statusContent.body)}</p>${request.smt_candidate_id || smtCandidateId.trim() ? `<p><strong>SMT reference:</strong> ${escapeHtml(smtCandidateId.trim() || request.smt_candidate_id)}</p>` : ""}<p><a href="${portalUrl}" style="display:inline-block;background:#861f24;color:white;text-decoration:none;padding:12px 18px;border-radius:8px">View exam registration</a></p><p style="font-size:13px;color:#667085">Arizona Board for Certification of Addiction Counselors</p></div>`,
  });

  try { await admin.from("admin_audit_log").insert({ admin_id: adminId, action: `testing_request_${status}`, target_table: "testing_requests", target_id: id, details: { note: note.trim() || null, smt_candidate_id: smtCandidateId.trim() || null } }); } catch { /* best effort */ }
  revalidatePath("/admin/testing");
  revalidatePath(`/admin/testing/${id}`);
  revalidatePath("/account/testing");
  return { ok: true };
}

function escapeHtml(value: string) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] as string));
}
