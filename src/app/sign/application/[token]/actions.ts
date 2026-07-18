"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import type { FormAnnotation } from "@/lib/digital-form-types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type SignerResult = { ok: true; message: string } | { ok: false; error: string };

function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function sanitizeAnnotations(value: FormAnnotation[]) {
  return (value ?? []).slice(0, 800).map((annotation) => ({
    id: clean(annotation.id, 80),
    page: Math.max(1, Math.trunc(Number(annotation.page) || 1)),
    x: Math.max(0, Math.min(1, Number(annotation.x) || 0)),
    y: Math.max(0, Math.min(1, Number(annotation.y) || 0)),
    value: clean(annotation.value, 2000),
    type: ["text", "check", "date", "signature"].includes(annotation.type) ? annotation.type : "text",
    author: "signer" as const,
  })) as FormAnnotation[];
}

export async function saveSignerForm(input: {
  token: string;
  annotations: FormAnnotation[];
  signatureName: string;
  final: boolean;
  consent: boolean;
}): Promise<SignerResult> {
  const token = clean(input.token, 200);
  if (!token) return { ok: false, error: "This secure link is invalid." };
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const admin = createSupabaseAdminClient();
  const { data: request } = await admin.from("application_signer_requests").select("id,status,expires_at").eq("token_hash", tokenHash).maybeSingle();
  if (!request || request.status === "revoked") return { ok: false, error: "This secure request is unavailable." };
  if (new Date(request.expires_at).getTime() < Date.now()) return { ok: false, error: "This secure request has expired. Ask the applicant to send a new invitation." };
  if (request.status === "signed") return { ok: false, error: "This request has already been signed and submitted." };

  const annotations = sanitizeAnnotations(input.annotations);
  const signatureName = clean(input.signatureName, 160);
  if (input.final) {
    if (!input.consent) return { ok: false, error: "Confirm the electronic signature statement before submitting." };
    if (!signatureName) return { ok: false, error: "Enter your full legal name." };
    if (!annotations.some((annotation) => annotation.type === "signature" && annotation.value.trim())) {
      return { ok: false, error: "Place your signature on the required signature line in the form before submitting." };
    }
  }

  const now = new Date().toISOString();
  const { error } = await admin.from("application_signer_requests").update({
    annotations,
    signature_name: signatureName || null,
    status: input.final ? "signed" : "opened",
    opened_at: now,
    signed_at: input.final ? now : null,
  }).eq("id", request.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/sign/application/${token}`);
  revalidatePath("/admin/applications");
  return { ok: true, message: input.final ? "Your signed section was securely submitted to ABCAC." : "Your progress was saved on this secure request." };
}
