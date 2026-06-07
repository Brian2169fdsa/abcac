import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssistantTool, ToolExecutor } from "./run";
import {
  computeCompliance,
  requirementsFromSchedule,
  type CeuLike,
} from "@/lib/ceu-compliance";
import {
  findScheduleFor,
  computeDueFromExpiration,
  type CertSchedule,
} from "@/lib/schedules";

/**
 * MEMBER tool definitions + executors.
 *
 * SECURITY: every executor operates ONLY on the caller's own rows. We NEVER
 * accept a member_id/user_id argument from the model — we always use the
 * server-resolved `uid` (auth.uid()). All reads/writes go through the
 * RLS-scoped cookie client (`sb`, the anon-key server client), so the database
 * enforces ownership even if a tool tried to reach further. Members cannot
 * touch role/approval/email or another member's data.
 *
 * Writes (log_ceu, submit_name_change, submit_verification_request,
 * start_reciprocity, send_message_to_admin, update_my_profile) mirror the real
 * portal write paths (ceu-submit-form, portal-forms, profile-form) so the
 * assistant reuses the exact same tables/columns the manual UI uses.
 */

export interface MemberToolContext {
  /** RLS-scoped Supabase client bound to the caller's cookie session. */
  sb: SupabaseClient;
  /** The caller's auth user id — the ONLY identity member tools ever write. */
  uid: string;
}

const ALLOWED_PROFILE_FIELDS = ["name", "phone", "address", "city", "state", "zip"] as const;
const CEU_CATEGORIES = ["General", "Ethics", "Cultural Diversity", "HIV/AIDS"];

export function getMemberTools(): AssistantTool[] {
  return [
    {
      name: "get_my_overview",
      description:
        "Get the signed-in member's own account snapshot: profile basics, account status, and their certifications with status and expiration. Use this first when the member asks broadly about their account.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "get_my_ceu_status",
      description:
        "Get the member's CEU renewal compliance per active credential: approved total hours, ethics and cultural hours, and how many more hours are remaining toward the requirement.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "get_my_renewals",
      description:
        "Get the member's upcoming credential renewal due dates, days until due, and whether any credential is in a grace period or lapsed.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "get_my_documents",
      description: "List the member's uploaded documents with type, file name, and review status.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "get_my_invoices",
      description: "List the member's invoices with description, amount, and paid/unpaid status.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "get_my_messages",
      description: "List the member's inbox messages from ABCAC (subject, read/unread, date).",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "get_my_requests",
      description:
        "List the member's submitted requests across name-change, verification, and reciprocity, with their statuses.",
      input_schema: { type: "object", properties: {} },
    },
    {
      name: "log_ceu",
      description:
        "Log a new CEU record for the member (status starts as pending review). Confirm course, provider, hours, category, and completion date with the member before calling.",
      input_schema: {
        type: "object",
        properties: {
          course: { type: "string", description: "Course / workshop name." },
          provider: { type: "string", description: "CEU provider." },
          hours: { type: "number", description: "Number of CEU hours." },
          category: {
            type: "string",
            enum: CEU_CATEGORIES,
            description: "CEU category.",
          },
          date: { type: "string", description: "Completion date (YYYY-MM-DD)." },
        },
        required: ["course", "provider", "hours", "category", "date"],
      },
    },
    {
      name: "submit_name_change",
      description:
        "Submit a legal name change request for the member (pending review). Confirm the new legal name first.",
      input_schema: {
        type: "object",
        properties: {
          new_name: { type: "string", description: "The member's new legal name." },
          note: {
            type: "string",
            description: "Reason for the change (e.g. Marriage, Divorce, Court Order, Other).",
          },
        },
        required: ["new_name"],
      },
    },
    {
      name: "submit_verification_request",
      description:
        "Submit a certification verification request on the member's behalf (pending review). Used to verify the member's own credential to a third party.",
      input_schema: {
        type: "object",
        properties: {
          purpose: { type: "string", description: "Purpose, e.g. 'Employer verification'." },
          recipient_name: { type: "string", description: "Who should receive the verification." },
          recipient_email: { type: "string", description: "Recipient email (optional)." },
          notes: { type: "string", description: "Any additional notes (optional)." },
        },
        required: ["purpose", "recipient_name"],
      },
    },
    {
      name: "start_reciprocity",
      description:
        "Start an IC&RC reciprocity request for the member. Direction 'out_of_az' (transfer out, $150 fee billed separately) or 'into_az' (inbound notice, no fee).",
      input_schema: {
        type: "object",
        properties: {
          direction: {
            type: "string",
            enum: ["out_of_az", "into_az"],
            description: "Transfer direction.",
          },
          credential: { type: "string", description: "Credential being transferred (optional)." },
          destination: {
            type: "string",
            description:
              "For out_of_az: the destination board. For into_az: the origin board (optional).",
          },
          board_email: {
            type: "string",
            description:
              "For out_of_az: the destination board's email (required). For into_az: origin board email (optional).",
          },
          reason: { type: "string", description: "Reason / notes (optional)." },
        },
        required: ["direction"],
      },
    },
    {
      name: "send_message_to_admin",
      description:
        "Send a message from the member to ABCAC admin. Confirm the subject and body with the member first.",
      input_schema: {
        type: "object",
        properties: {
          subject: { type: "string", description: "Message subject." },
          body: { type: "string", description: "Message body." },
        },
        required: ["subject", "body"],
      },
    },
    {
      name: "update_my_profile",
      description:
        "Update allowed fields on the member's own profile. Only name, phone, address, city, state, and zip may be changed — never email, role, or status.",
      input_schema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Full legal name (split into first/last)." },
          phone: { type: "string" },
          address: { type: "string", description: "Street / mailing address line." },
          city: { type: "string" },
          state: { type: "string" },
          zip: { type: "string" },
        },
      },
    },
  ];
}

export function getMemberExecutors(ctx: MemberToolContext): Record<string, ToolExecutor> {
  const { sb, uid } = ctx;

  async function fetchSchedules(): Promise<CertSchedule[]> {
    try {
      const { data } = await sb
        .from("cert_schedules")
        .select(
          "credential_type, renewal_cycle_months, ceu_total_required, ceu_ethics_required, ceu_cultural_required, grace_period_days, notes",
        );
      return (data as CertSchedule[]) ?? [];
    } catch {
      return [];
    }
  }

  return {
    async get_my_overview() {
      const { data: profile } = await sb
        .from("profiles")
        .select(
          "first_name,last_name,email,phone,city,state,zip_code,cert_status,account_status",
        )
        .eq("id", uid)
        .maybeSingle();
      const { data: certs } = await sb
        .from("certifications")
        .select("cert_type,cert_number,status,expiration_date,ic_rc_level")
        .eq("member_id", uid);
      return JSON.stringify({ profile: profile ?? null, certifications: certs ?? [] });
    },

    async get_my_ceu_status() {
      const [{ data: ceus }, { data: certs }, schedules] = await Promise.all([
        sb.from("ceu_records").select("hours,category,status").eq("member_id", uid),
        sb
          .from("certifications")
          .select("cert_type,status,expiration_date")
          .eq("member_id", uid),
        fetchSchedules(),
      ]);
      const records = (ceus as CeuLike[]) ?? [];
      const activeCerts = (certs ?? []).filter(
        (c: { status: string | null }) => c.status === "active",
      );
      if (activeCerts.length === 0) {
        const compliance = computeCompliance(records);
        return JSON.stringify({
          note: "No active credential on file; showing default 40/3/3 requirement.",
          compliance,
        });
      }
      const perCredential = activeCerts.map(
        (c: { cert_type: string | null }) => {
          const schedule = findScheduleFor(schedules, c.cert_type);
          return {
            credential: c.cert_type,
            compliance: computeCompliance(records, requirementsFromSchedule(schedule)),
          };
        },
      );
      return JSON.stringify({ perCredential });
    },

    async get_my_renewals() {
      const [{ data: certs }, schedules] = await Promise.all([
        sb
          .from("certifications")
          .select("cert_type,cert_number,status,expiration_date")
          .eq("member_id", uid),
        fetchSchedules(),
      ]);
      const rows = (certs ?? [])
        .filter((c: { status: string | null }) => c.status === "active")
        .map(
          (c: {
            cert_type: string | null;
            cert_number: string | null;
            expiration_date: string | null;
          }) => {
            const schedule = findScheduleFor(schedules, c.cert_type);
            if (schedule && c.expiration_date) {
              const due = computeDueFromExpiration(schedule, c.expiration_date);
              return {
                credential: c.cert_type,
                cert_number: c.cert_number,
                next_due_date: due.nextDueDate,
                days_until_due: due.daysUntilDue,
                tier: due.tier,
                in_grace_period: due.inGracePeriod,
                lapsed: due.lapsed,
              };
            }
            return {
              credential: c.cert_type,
              cert_number: c.cert_number,
              next_due_date: c.expiration_date,
              days_until_due: c.expiration_date
                ? Math.ceil(
                    (new Date(c.expiration_date).getTime() - Date.now()) / 86_400_000,
                  )
                : null,
            };
          },
        );
      return JSON.stringify({ renewals: rows });
    },

    async get_my_documents() {
      const { data } = await sb
        .from("documents")
        .select("document_type,file_name,status,uploaded_at")
        .eq("member_id", uid)
        .order("uploaded_at", { ascending: false });
      return JSON.stringify({ documents: data ?? [] });
    },

    async get_my_invoices() {
      const { data } = await sb
        .from("invoices")
        .select("invoice_number,description,amount_cents,status,created_at,paid_at")
        .eq("member_id", uid)
        .order("created_at", { ascending: false });
      return JSON.stringify({ invoices: data ?? [] });
    },

    async get_my_messages() {
      const { data } = await sb
        .from("messages")
        .select("subject,body,from_name,is_read,created_at")
        .eq("member_id", uid)
        .order("created_at", { ascending: false })
        .limit(25);
      return JSON.stringify({ messages: data ?? [] });
    },

    async get_my_requests() {
      const [{ data: nameChanges }, { data: verifications }, { data: reciprocity }] =
        await Promise.all([
          sb
            .from("name_change_requests")
            .select("new_name,reason,status,submitted_at")
            .eq("member_id", uid),
          sb
            .from("verification_requests")
            .select("purpose,recipient_name,status,submitted_at")
            .eq("member_id", uid),
          sb
            .from("reciprocity_requests")
            .select("direction,credential,destination,status,submitted_at")
            .eq("member_id", uid),
        ]);
      return JSON.stringify({
        name_change_requests: nameChanges ?? [],
        verification_requests: verifications ?? [],
        reciprocity_requests: reciprocity ?? [],
      });
    },

    async log_ceu(input) {
      const hours = Number(input.hours);
      if (!input.course || !input.provider || !input.category || !input.date || !(hours > 0)) {
        throw new Error("Missing or invalid CEU fields (course, provider, hours, category, date).");
      }
      const { error } = await sb.from("ceu_records").insert({
        member_id: uid,
        course_name: String(input.course),
        provider: String(input.provider),
        hours,
        category: String(input.category),
        completion_date: String(input.date),
        status: "pending",
      });
      if (error) throw new Error(error.message);
      return `Logged CEU "${String(input.course)}" (${hours} hrs, ${String(input.category)}) — pending review.`;
    },

    async submit_name_change(input) {
      if (!input.new_name) throw new Error("new_name is required.");
      const { data: profile } = await sb
        .from("profiles")
        .select("first_name,last_name")
        .eq("id", uid)
        .maybeSingle();
      const currentName =
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Member";
      const { error } = await sb.from("name_change_requests").insert({
        member_id: uid,
        current_name: currentName,
        new_name: String(input.new_name),
        reason: input.note ? String(input.note) : "Other",
        status: "pending",
      });
      if (error) throw new Error(error.message);
      return `Submitted name change request to "${String(input.new_name)}" — pending review.`;
    },

    async submit_verification_request(input) {
      if (!input.purpose || !input.recipient_name) {
        throw new Error("purpose and recipient_name are required.");
      }
      const { error } = await sb.from("verification_requests").insert({
        member_id: uid,
        purpose: String(input.purpose),
        recipient_name: String(input.recipient_name),
        recipient_email: input.recipient_email ? String(input.recipient_email) : null,
        notes: input.notes ? String(input.notes) : null,
        status: "pending",
      });
      if (error) throw new Error(error.message);
      return `Submitted verification request for "${String(input.purpose)}" — pending review.`;
    },

    async start_reciprocity(input) {
      const direction = String(input.direction ?? "");
      if (direction !== "out_of_az" && direction !== "into_az") {
        throw new Error("direction must be 'out_of_az' or 'into_az'.");
      }
      const isOut = direction === "out_of_az";
      if (isOut && !input.board_email) {
        throw new Error("Destination board email is required for an out-of-Arizona transfer.");
      }
      const row: Record<string, unknown> = {
        member_id: uid,
        direction,
        credential: input.credential ? String(input.credential) : null,
        destination: input.destination ? String(input.destination) : null,
        reason: input.reason ? String(input.reason) : null,
        status: "pending",
      };
      if (isOut) {
        row.destination_board_email = input.board_email ? String(input.board_email) : null;
        row.fee_cents = 15000;
        row.payment_status = "unpaid";
      } else {
        row.origin_board = input.destination ? String(input.destination) : null;
        row.origin_board_email = input.board_email ? String(input.board_email) : null;
        row.fee_cents = 0;
        row.payment_status = "none";
      }
      const { error } = await sb.from("reciprocity_requests").insert(row);
      if (error) throw new Error(error.message);
      return isOut
        ? "Started an out-of-Arizona reciprocity request — a $150 transfer fee applies and ABCAC will follow up on payment."
        : "Started an inbound (into-Arizona) reciprocity notice — no fee is due.";
    },

    async send_message_to_admin(input) {
      if (!input.subject || !input.body) throw new Error("subject and body are required.");
      // The 014 guard trigger pins member_id/sender_role/is_read/from_name for
      // non-admin callers, so this is attributed to the member regardless.
      const { error } = await sb.from("messages").insert({
        member_id: uid,
        sender_role: "member",
        subject: String(input.subject),
        body: String(input.body),
        is_read: false,
      });
      if (error) throw new Error(error.message);
      return `Sent your message "${String(input.subject)}" to ABCAC.`;
    },

    async update_my_profile(input) {
      const patch: Record<string, unknown> = {};
      const provided = ALLOWED_PROFILE_FIELDS.filter((f) => input[f] !== undefined);
      if (provided.length === 0) {
        throw new Error("Provide at least one of: name, phone, address, city, state, zip.");
      }
      if (input.name !== undefined) {
        const parts = String(input.name).trim().split(/\s+/);
        patch.first_name = parts.shift() ?? "";
        patch.last_name = parts.join(" ") || patch.first_name;
      }
      if (input.phone !== undefined) patch.phone = String(input.phone);
      if (input.address !== undefined) patch.address_line1 = String(input.address);
      if (input.city !== undefined) patch.city = String(input.city);
      if (input.state !== undefined) patch.state = String(input.state);
      if (input.zip !== undefined) patch.zip_code = String(input.zip);
      // The 009 guard_profile_update trigger forbids role/approval columns for
      // non-admins, so this can only ever touch the safe fields above.
      const { error } = await sb.from("profiles").update(patch).eq("id", uid);
      if (error) throw new Error(error.message);
      return `Updated your profile (${provided.join(", ")}).`;
    },
  };
}
