"use server";

import { requireUserId } from "@/lib/auth/current-user";
import { isCredentialLevel, isExamCode, isTestingMode } from "@/lib/testing-requests";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type TestingRequestInput = {
  purchaserFirstName: string;
  purchaserLastName: string;
  purchaserEmail: string;
  purchaserPhone: string;
  purchaserAddress: string;
  purchaserDateOfBirth: string;
  examCode: string;
  testingMode: string;
  testingLocation: string;
  seeksAbcacCredential: boolean;
  credentialLevel: string;
  azbbheApproved: boolean;
  payingForOther: boolean;
  testerFirstName: string;
  testerLastName: string;
  testerEmail: string;
  testerAddress: string;
  testerDateOfBirth: string;
  accommodationsRequested: boolean;
  accommodationsDetail?: string[];
};

type Result = { ok: true; id: string } | { ok: false; error: string };
type SupportingDocument = { name: string; path: string };

function clean(value: string) {
  return value.trim();
}

export async function createTestingRequest(input: TestingRequestInput): Promise<Result> {
  const memberId = await requireUserId();
  const purchaser = {
    firstName: clean(input.purchaserFirstName),
    lastName: clean(input.purchaserLastName),
    email: clean(input.purchaserEmail).toLowerCase(),
    phone: clean(input.purchaserPhone),
    address: clean(input.purchaserAddress),
    dob: input.purchaserDateOfBirth,
  };
  const tester = input.payingForOther
    ? {
        firstName: clean(input.testerFirstName),
        lastName: clean(input.testerLastName),
        email: clean(input.testerEmail).toLowerCase(),
        address: clean(input.testerAddress),
        dob: input.testerDateOfBirth,
      }
    : { firstName: purchaser.firstName, lastName: purchaser.lastName, email: purchaser.email, address: purchaser.address, dob: purchaser.dob };

  if (!purchaser.firstName || !purchaser.lastName || !purchaser.email || !purchaser.phone || !purchaser.address || !purchaser.dob) {
    return { ok: false, error: "Complete all purchaser fields." };
  }
  if (!tester.firstName || !tester.lastName || !tester.email || !tester.address || !tester.dob) {
    return { ok: false, error: "Complete all tester fields." };
  }
  if (!isExamCode(input.examCode) || !isTestingMode(input.testingMode)) {
    return { ok: false, error: "Select a valid exam and testing mode." };
  }
  if (input.seeksAbcacCredential && !isCredentialLevel(input.credentialLevel)) {
    return { ok: false, error: "Select the ABCAC credential you are pursuing." };
  }
  if (input.testingMode === "in_person" && !clean(input.testingLocation)) {
    return { ok: false, error: "Enter your preferred in-person testing area." };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.from("testing_requests").insert({
    member_id: memberId,
    purchaser_first_name: purchaser.firstName,
    purchaser_last_name: purchaser.lastName,
    purchaser_email: purchaser.email,
    purchaser_phone: purchaser.phone,
    purchaser_address: purchaser.address,
    purchaser_date_of_birth: purchaser.dob,
    exam_code: input.examCode,
    testing_mode: input.testingMode,
    testing_location: input.testingMode === "in_person" ? clean(input.testingLocation) : "Remote proctored",
    seeks_abcac_credential: input.seeksAbcacCredential,
    credential_level: input.seeksAbcacCredential ? input.credentialLevel : null,
    azbbhe_approved: input.azbbheApproved,
    paying_for_other: input.payingForOther,
    tester_first_name: tester.firstName,
    tester_last_name: tester.lastName,
    tester_email: tester.email,
    tester_address: tester.address,
    tester_date_of_birth: tester.dob,
    accommodations_requested: input.accommodationsRequested,
    accommodations_detail: input.accommodationsRequested && input.accommodationsDetail?.length
      ? input.accommodationsDetail.map((item) => clean(item)).filter(Boolean).slice(0, 20).join("; ")
      : null,
  }).select("id").single();

  if (error || !data) return { ok: false, error: error?.message ?? "Could not save your request." };
  return { ok: true, id: data.id };
}

export async function attachTestingDocuments(id: string, documents: SupportingDocument[]): Promise<{ ok: boolean; error?: string }> {
  const memberId = await requireUserId();
  const cleanDocuments = documents
    .filter((document) => document.name.trim() && document.path.startsWith(`${memberId}/testing/${id}/`))
    .slice(0, 10)
    .map((document) => ({ name: document.name.trim().slice(0, 255), path: document.path }));
  if (cleanDocuments.length !== documents.length) return { ok: false, error: "Invalid supporting document." };

  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("testing_requests").update({ supporting_documents: cleanDocuments }).eq("id", id).eq("member_id", memberId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
