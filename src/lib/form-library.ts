export type FormCategory = "initial" | "renewal" | "board" | "ceu" | "testing";

export type FormDefinition = {
  key: string;
  title: string;
  shortTitle: string;
  category: FormCategory;
  href: string;
  pages: number;
  description: string;
};

export type FormWorkflow = {
  key: string;
  title: string;
  shortTitle: string;
  appType: string;
  certType: string;
  category: FormCategory;
  formKeys: string[];
};

export const FORM_LIBRARY: FormDefinition[] = [
  { key: "initial-general", title: "General Certification Application Manual", shortTitle: "General Application", category: "initial", href: "/forms/library/initial-general.pdf", pages: 17, description: "General application, background, employment, education, residency, releases, and Code of Ethics." },
  { key: "initial-cac-supplement", title: "CAC Supplemental Application Manual", shortTitle: "CAC Supplemental", category: "initial", href: "/forms/library/initial-cac-supplement.pdf", pages: 15, description: "CAC education, supervised experience, work logs, supervisor verification, and counselor evaluation." },
  { key: "initial-cadac-aadc-supplement", title: "CADAC / AADC Supplemental Application Manual", shortTitle: "CADAC / AADC Supplemental", category: "initial", href: "/forms/library/initial-cadac-aadc-supplement.pdf", pages: 15, description: "CADAC and AADC education, experience, work logs, supervisor verification, and counselor evaluation." },
  { key: "initial-cprs", title: "Certified Peer Recovery Specialist Application Manual", shortTitle: "CPRS Application", category: "initial", href: "/forms/library/initial-cprs.pdf", pages: 14, description: "CPRS application, education, experience, references, supervision, attestations, and signatures." },
  { key: "initial-ccs", title: "Certified Clinical Supervisor Application Manual", shortTitle: "CCS Application", category: "initial", href: "/forms/library/initial-ccs.pdf", pages: 23, description: "Clinical supervision application, employment, education, evaluations, recommendations, and signatures." },
  { key: "initial-ccjp", title: "Certified Criminal Justice Professional Application Manual", shortTitle: "CCJP Application", category: "initial", href: "/forms/library/initial-ccjp.pdf", pages: 25, description: "CCJP application, education, experience, practicum logs, recommendations, ethics, and signatures." },
  { key: "initial-cps", title: "Certified Prevention Specialist Application Manual", shortTitle: "CPS Application", category: "initial", href: "/forms/library/initial-cps.pdf", pages: 25, description: "CPS application, prevention experience, education, supervision, evaluations, and signatures." },
  { key: "recert-cac-cadac-aadc", title: "CAC / CADAC / AADC Recertification Packet", shortTitle: "Counselor Recertification", category: "renewal", href: "/forms/library/recert-cac-cadac-aadc.pdf", pages: 5, description: "Two-year counselor recertification packet and continuing education record." },
  { key: "recert-cps", title: "Certified Prevention Specialist Recertification Packet", shortTitle: "CPS Recertification", category: "renewal", href: "/forms/library/recert-cps.pdf", pages: 5, description: "CPS recertification application and continuing education record." },
  { key: "recert-ccs", title: "Certified Clinical Supervisor Recertification Packet", shortTitle: "CCS Recertification", category: "renewal", href: "/forms/library/recert-ccs.pdf", pages: 5, description: "CCS recertification application and continuing education record." },
  { key: "recert-ccjp", title: "Certified Criminal Justice Addictions Professional Recertification Packet", shortTitle: "CCJP Recertification", category: "renewal", href: "/forms/library/recert-ccjp.pdf", pages: 5, description: "CCJP recertification application and continuing education record." },
  { key: "recert-cprs", title: "Certified Peer Recovery Specialist Recertification Packet", shortTitle: "CPRS Recertification", category: "renewal", href: "/forms/library/recert-cprs.pdf", pages: 5, description: "CPRS recertification application and continuing education record." },
  { key: "board-member", title: "ABCAC Board Member Application", shortTitle: "Board Member Application", category: "board", href: "/forms/library/board-member.pdf", pages: 3, description: "Board candidate background, experience, interests, disclosure, and signature." },
  { key: "ceu-workshop", title: "CEU Workshop Endorsement Application", shortTitle: "CEU Workshop Application", category: "ceu", href: "/forms/library/ceu-workshop.pdf", pages: 5, description: "Workshop provider, program, presenter, objectives, schedule, and endorsement information." },
  { key: "testing-special-accommodations", title: "Testing Special Accommodations Form", shortTitle: "Testing Accommodations", category: "testing", href: "/forms/library/testing-special-accommodations.pdf", pages: 2, description: "Request approved testing accommodations while preserving the original ABCAC form and supporting documentation requirements." },
];

export const INITIAL_PACKET_FOR_CREDENTIAL: Record<string, string[]> = {
  CAC: ["initial-general", "initial-cac-supplement"],
  CADAC: ["initial-general", "initial-cadac-aadc-supplement"],
  AADC: ["initial-general", "initial-cadac-aadc-supplement"],
  CPRS: ["initial-cprs"],
  CCS: ["initial-ccs"],
  CCJP: ["initial-ccjp"],
  CPS: ["initial-cps"],
};

const STANDALONE_WORKFLOWS: FormWorkflow[] = [
  { key: "renewal:counselor", title: "CAC / CADAC / AADC Recertification", shortTitle: "Counselor Recertification", appType: "renewal", certType: "CAC/CADAC/AADC", category: "renewal", formKeys: ["recert-cac-cadac-aadc"] },
  { key: "renewal:cps", title: "Certified Prevention Specialist Recertification", shortTitle: "CPS Recertification", appType: "renewal", certType: "CPS", category: "renewal", formKeys: ["recert-cps"] },
  { key: "renewal:ccs", title: "Certified Clinical Supervisor Recertification", shortTitle: "CCS Recertification", appType: "renewal", certType: "CCS", category: "renewal", formKeys: ["recert-ccs"] },
  { key: "renewal:ccjp", title: "Certified Criminal Justice Addictions Professional Recertification", shortTitle: "CCJP Recertification", appType: "renewal", certType: "CCJP", category: "renewal", formKeys: ["recert-ccjp"] },
  { key: "renewal:cprs", title: "Certified Peer Recovery Specialist Recertification", shortTitle: "CPRS Recertification", appType: "renewal", certType: "CPRS", category: "renewal", formKeys: ["recert-cprs"] },
  { key: "board:member", title: "ABCAC Board Member Application", shortTitle: "Board Application", appType: "board_member", certType: "Board Member", category: "board", formKeys: ["board-member"] },
  { key: "ceu:workshop", title: "CEU Workshop Endorsement Application", shortTitle: "CEU Workshop", appType: "ceu_workshop", certType: "Workshop Endorsement", category: "ceu", formKeys: ["ceu-workshop"] },
  { key: "testing:accommodations", title: "Testing Special Accommodations Request", shortTitle: "Testing Accommodations", appType: "testing_accommodations", certType: "IC&RC Exam", category: "testing", formKeys: ["testing-special-accommodations"] },
];

export const FORM_WORKFLOWS: FormWorkflow[] = [
  ...Object.entries(INITIAL_PACKET_FOR_CREDENTIAL).map(([credential, formKeys]) => ({
    key: `initial:${credential.toLowerCase()}`,
    title: `${credential} Initial Certification`,
    shortTitle: credential,
    appType: "initial",
    certType: credential,
    category: "initial" as const,
    formKeys,
  })),
  ...STANDALONE_WORKFLOWS,
];

export function getFormDefinition(key: string) {
  return FORM_LIBRARY.find((form) => form.key === key);
}

export function getInitialPacket(credential: string) {
  return (INITIAL_PACKET_FOR_CREDENTIAL[credential.toUpperCase()] ?? [])
    .map(getFormDefinition)
    .filter((form): form is FormDefinition => Boolean(form));
}

export function getFormWorkflow(key: string) {
  return FORM_WORKFLOWS.find((workflow) => workflow.key === key);
}

/**
 * Fee products due at the END of each application workflow. After the packet
 * is submitted, the workspace shows these as the final "pay your fee" step,
 * deep-linking into the portal Payments page. Workflows without an entry
 * (board, testing accommodations) carry no fee.
 */
export const WORKFLOW_FEES: Record<string, Array<{ slug: string; label: string }>> = {
  "initial:cac": [
    { slug: "initial-certification-full-application-exam-fee", label: "Application + in-person exam fee" },
    { slug: "initial-certification-full-application-exam-fee-remote-proctored-exam", label: "Application + remote-proctored exam fee" },
    { slug: "certification-certification-only-fee-already-passed-icrc-exam", label: "Certification-only fee (already passed the IC&RC exam)" },
  ],
  "renewal:counselor": [{ slug: "certification-renewal-2-year-credential-renewal-fee", label: "Two-year recertification fee" }],
  "ceu:workshop": [
    { slug: "ceu-workshop-endorsement-up-to-8-contact-hours", label: "Workshop of 8 contact hours or less" },
    { slug: "ceu-workshop-endorsement-9-15-contact-hours", label: "Workshop of 9–15 contact hours" },
    { slug: "ceu-workshop-endorsement-more-than-15-contact-hours", label: "Workshop over 15 contact hours" },
  ],
};
// The other initial credentials and recert packets share the same fee products.
for (const key of ["initial:cadac", "initial:aadc", "initial:ccs", "initial:ccjp", "initial:cprs", "initial:cps"]) {
  WORKFLOW_FEES[key] = WORKFLOW_FEES["initial:cac"];
}
for (const key of ["renewal:cps", "renewal:ccs", "renewal:ccjp", "renewal:cprs"]) {
  WORKFLOW_FEES[key] = WORKFLOW_FEES["renewal:counselor"];
}

export function getWorkflowFees(workflowKey: string) {
  return WORKFLOW_FEES[workflowKey] ?? [];
}

export function getWorkflowForms(workflow: FormWorkflow) {
  return workflow.formKeys.map(getFormDefinition).filter((form): form is FormDefinition => Boolean(form));
}
