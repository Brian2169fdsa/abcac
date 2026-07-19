export const EXAM_OPTIONS = [
  { value: "ADC", label: "ADC — Alcohol and Drug Counselor · LACT (formerly LSAT) · ABCAC CAC / CADAC", credentials: "CAC / CADAC" },
  { value: "AADC", label: "AADC — Advanced Alcohol and Drug Counselor · LAAC / LIAC (formerly LASAC / LISAC) · ABCAC AADC", credentials: "AADC / LAAC / LIAC" },
  { value: "CS", label: "CS — Clinical Supervisor · ABCAC CCS", credentials: "CCS" },
  { value: "CCJP", label: "CCJP — Criminal Justice Professional · ABCAC CCJP", credentials: "CCJP" },
  { value: "PR", label: "PR — Peer Recovery · ABCAC CPRS", credentials: "CPRS" },
  { value: "PS", label: "PS — Prevention Specialist · ABCAC CPS", credentials: "CPS" },
] as const;

/** Specific accommodations from the original ABCAC pre-registration form.
 *  Special accommodations must be approved in advance. */
export const ACCOMMODATION_OPTIONS = [
  "Adjustable Table Height",
  "Allowed to Turn On/Off Lights in Separate Room",
  "Allowed to Walk and/or Stretch",
  "Candidate Supplied Glucose Meter",
  "Candidate Supplied Multiple Glasses",
  "Candidate Supplied Sugar Drink",
  "Candidate's Magnifying Glass",
  "Extended Scheduled Breaks",
  "Extended Time",
  "Flexible Breaks",
  "Language Interpreter",
  "Reader Required",
  "Separate Room",
  "Sign Language Interpreter",
  "Special Chair",
] as const;

export const CREDENTIAL_OPTIONS = ["CAC", "CADAC", "AADC", "CCS", "CCJP", "CPRS", "CPS"] as const;
export type TestingMode = "in_person" | "remote";

export const TESTING_PRODUCT_BY_MODE: Record<TestingMode, string> = {
  in_person: "testing-for-licensure-with-azbbhe",
  remote: "testing-for-licensure-with-azbbhe-remote-proctored-exam",
};

export const TESTING_STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Awaiting payment",
  paid: "Ready for ABCAC review",
  processing: "ABCAC is pre-registering you",
  pre_registered: "Pre-registration complete",
  on_hold: "More information needed",
  cancelled: "Cancelled",
};

export function testingStatusLabel(status: string) {
  return TESTING_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

export function isExamCode(value: string) {
  return EXAM_OPTIONS.some((option) => option.value === value);
}

export function isCredentialLevel(value: string) {
  return CREDENTIAL_OPTIONS.includes(value as (typeof CREDENTIAL_OPTIONS)[number]);
}

export function isTestingMode(value: string): value is TestingMode {
  return value === "in_person" || value === "remote";
}
