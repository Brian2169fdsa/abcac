import type { AnnotationType, FormAnnotation, SmartFormField } from "@/lib/digital-form-types";

// Native (HTML) versions of ABCAC forms. Each schema reproduces the content of
// the original PDF as structured fields so members fill a real form instead of
// typing into boxes floated over a rendered PDF image. Values are stored as the
// same FormAnnotation[] shape the PDF editor uses (fieldId = schema field id),
// so drafts, submission, signer requests, and admin review work unchanged.

export type NativeFieldType = AnnotationType | "yesno" | "textarea";

export type NativeField = {
  id: string;
  label: string;
  type: NativeFieldType;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  /** Render width hint inside the section grid. */
  span?: "full" | "half" | "third";
  /** When set, the question shows a follow-up detail input if answered Yes. */
  detailLabel?: string;
};

export type NativeTable = {
  id: string;
  columns: Array<{ id: string; label: string; width?: "wide" | "narrow" }>;
  rows: number;
  /** Fixed labels for the first column of the first rows (e.g. Ethics). */
  fixedFirstColumn?: string[];
};

export type NativeSection = {
  id: string;
  title: string;
  description?: string;
  /** Bullet list rendered before the fields (requirements, instructions). */
  notes?: string[];
  /** Page of the original PDF this section came from (for admin reference). */
  pdfPage: number;
  fields?: NativeField[];
  table?: NativeTable;
  /** Section is expected to be completed by an invited signer, not the applicant. */
  signerSection?: { role: string };
};

export type NativeFormSchema = {
  formKey: string;
  intro?: { title: string; paragraphs: string[] };
  sections: NativeSection[];
};

const YES_NO_BACKGROUND: Array<{ id: string; label: string; detailed?: boolean }> = [
  { id: "held-other", label: "Do you hold, or have you ever held licensure, certification, or registration in any other state or with any other agency?" },
  { id: "held-association", label: "Do you hold or have held a certificate through a behavioral health professional association?" },
  { id: "denied", label: "Have you ever applied for and been denied a license, certificate or registration with any authorized certifying agency?" },
  { id: "disciplined", label: "Have you ever had any disciplinary action taken against you by the authority issuing a license, certificate or registration in any behavioral health profession?" },
  { id: "surrendered", label: "Have you surrendered or cancelled your license, certification or registration in lieu of disciplinary proceedings by the issuing authority in any behavioral health profession?" },
  { id: "association-discipline", label: "Have you ever been the subject of a disciplinary action by a regulatory committee of a professional association?" },
  { id: "convicted", label: "Have you ever been convicted or pled guilty or pled no contest to a criminal offense?" },
  { id: "malpractice", label: "Have you ever been the defendant in a malpractice suit and either entered into a settlement agreement or paid court-awarded damages, or is such a suit pending?" },
  { id: "terminated", label: "Have you ever been involuntarily terminated from any behavioral health or related employment for unprofessional conduct?" },
];

/** The five recertification packets share one structure; only titles/wording vary. */
function recertificationSchema(formKey: string, credentialTitle: string, ceFocus: string): NativeFormSchema {
  return {
    formKey,
    intro: {
      title: `Application for ${credentialTitle} Recertification`,
      paragraphs: [
        "Renewal of your ABCAC certification is required every two years. Complete every section of this application.",        `Provide fully documented evidence of forty (40) clock hours of continuing education related to ${ceFocus} since your last certification. Three (3) hours of Ethics and three (3) hours of Cultural Diversity education/training are specifically required as part of the 40 hours. Attach documentation (grade reports, certificates of completion, attendance records, or letters from the training source) in the Documents section of your portal.`,
        "Up to twenty (20) hours of related Inservice Training are allowable towards recertification when attested by your current supervisor.",
        "The $150.00 recertification fee is payable online at checkout or by check or money order payable to ABCAC.",
      ],
    },
    sections: [
      {
        id: "certificates",
        title: "Certificate Numbers",
        pdfPage: 2,
        fields: [
          { id: "abcac-cert-number", label: "ABCAC Certificate #", type: "text", required: true, span: "half" },
          { id: "icrc-cert-number", label: "ICRC Certificate #", type: "text", span: "half", hint: "If you hold the optional IC&RC credential." },
        ],
      },
      {
        id: "demographic",
        title: "Demographic Update",
        pdfPage: 2,
        fields: [
          { id: "name-last", label: "Last name", type: "text", required: true, span: "third" },
          { id: "name-first", label: "First name", type: "text", required: true, span: "third" },
          { id: "name-mi", label: "Middle initial", type: "text", span: "third" },
          { id: "entry-date", label: "Entry date in field", type: "date", span: "half" },
          { id: "home-phone", label: "Home phone", type: "text", span: "half" },
          { id: "work-phone", label: "Work phone", type: "text", span: "half" },
          { id: "street-address", label: "Street address", type: "text", required: true, span: "half" },
          { id: "city", label: "City", type: "text", required: true, span: "third" },
          { id: "state", label: "State", type: "text", required: true, span: "third" },
          { id: "zip", label: "ZIP", type: "text", required: true, span: "third" },
          { id: "email", label: "Email address", type: "text", required: true, span: "half" },
          { id: "present-position", label: "Present position", type: "text", span: "half" },
          { id: "position-how-long", label: "How long?", type: "text", span: "half" },
          { id: "employer", label: "Employer", type: "text", span: "half" },
          { id: "supervisor-name", label: "Name of supervisor", type: "text", span: "half" },
          { id: "supervisor-phone", label: "Supervisor phone", type: "text", span: "half" },
        ],
      },
      {
        id: "education",
        title: "Formal Education",
        description: "Attach documentation for any formal education obtained within the last two years.",
        pdfPage: 2,
        fields: [
          { id: "education-level", label: "Highest level of education", type: "text", span: "half" },
          { id: "education-major", label: "Major", type: "text", span: "half" },
          { id: "education-institution", label: "Name of institution", type: "text", span: "half" },
          { id: "education-dates", label: "Dates attended", type: "text", span: "half" },
          { id: "education-other", label: "Other education", type: "text", span: "full" },
          { id: "education-other-institution", label: "Name of institution", type: "text", span: "half" },
          { id: "education-other-dates", label: "Dates attended", type: "text", span: "half" },
        ],
      },
      {
        id: "ce-summary",
        title: "Continuing Education Summary",
        pdfPage: 2,
        fields: [
          { id: "ce-from", label: "Period from", type: "date", required: true, span: "half" },
          { id: "ce-to", label: "Period to", type: "date", required: true, span: "half" },
          { id: "ce-approved-hours", label: "Approved training/education (no. of hours)", type: "text", required: true, span: "third" },
          { id: "ce-inservice-hours", label: "Related inservice training (no. of hours)", type: "text", span: "third" },
          { id: "ce-total-hours", label: "Total hours", type: "text", required: true, span: "third" },
        ],
      },
      {
        id: "background",
        title: "Credentialing Background Information",
        pdfPage: 3,
        fields: [
          ...YES_NO_BACKGROUND.map((question): NativeField => ({ id: `background-${question.id}`, label: question.label, type: "yesno", required: true })),
          { id: "background-credentials-held", label: "If you hold or held other licensure/certification: title of credential, state/agency, date of issue, and current status", type: "textarea", span: "full", hint: "Complete if you answered Yes to either of the first two questions." },
          { id: "background-explanation", label: "If the answer to any of these questions is YES, please explain", type: "textarea", span: "full", hint: "Use the Documents section of your portal to enclose any relevant records." },
          { id: "applicant-signature", label: "Signature", type: "signature", required: true, span: "full", hint: "I certify that the above information is correct and no attempt is made to make fraudulent claims of competency or to withhold pertinent information that may influence the granting of this ABCAC certificate of competency." },
        ],
      },
      {
        id: "ce-ledger",
        title: "Documentation of Substance Abuse Related Continuing Education",
        description: "List the continuing education obtained during the certification period. Ethics and Cultural Diversity entries are required.",
        pdfPage: 4,
        fields: [
          { id: "ledger-from", label: "Period from", type: "date", span: "half" },
          { id: "ledger-to", label: "Period to", type: "date", span: "half" },
        ],
        table: {
          id: "ce-ledger-table",
          columns: [
            { id: "course", label: "Course / Title", width: "wide" },
            { id: "presenter", label: "Presented by", width: "wide" },
            { id: "provider", label: "Provider #", width: "narrow" },
            { id: "hours", label: "Hours", width: "narrow" },
          ],
          rows: 12,
          fixedFirstColumn: ["Ethics", "Cultural Diversity"],
        },
      },
      {
        id: "ce-correspondence",
        title: "Approved Correspondence / Self-Directed Study Courses",
        pdfPage: 4,
        table: {
          id: "ce-correspondence-table",
          columns: [
            { id: "course", label: "Course / Title", width: "wide" },
            { id: "presenter", label: "Presented by", width: "wide" },
            { id: "provider", label: "Provider #", width: "narrow" },
            { id: "hours", label: "Hours", width: "narrow" },
          ],
          rows: 5,
        },
      },
      {
        id: "ce-certification",
        title: "Continuing Education Certification",
        pdfPage: 4,
        fields: [
          { id: "ledger-signature", label: "Signature", type: "signature", required: true, span: "full", hint: "I certify that the above training/education has been completed and this ledger is accurate. I have attached documentation for all listed hours of education." },
        ],
      },
      {
        id: "inservice",
        title: "Documentation of In-Service Training Related to Substance Abuse",
        description: "Complete this section only if you are counting inservice training hours. No more than 20 hours of in-service training are acceptable. Your current supervisor must sign this section — use “Invite signer” below to send it to them.",
        pdfPage: 5,
        signerSection: { role: "Supervisor" },
        fields: [
          { id: "inservice-name", label: "Name of person trained", type: "text", span: "half" },
          { id: "inservice-site", label: "Training completed at", type: "text", span: "half" },
          { id: "inservice-from", label: "From", type: "date", span: "half" },
          { id: "inservice-to", label: "To", type: "date", span: "half" },
        ],
        table: {
          id: "inservice-table",
          columns: [
            { id: "service-area", label: "Service area presented in training", width: "wide" },
            { id: "hours", label: "Hours", width: "narrow" },
          ],
          rows: 8,
        },
      },
      {
        id: "inservice-attestation",
        title: "Supervisor Attestation",
        description: "I verify that the above training has been completed and this ledger is accurate.",
        pdfPage: 5,
        signerSection: { role: "Supervisor" },
        fields: [
          { id: "inservice-total-hours", label: "Total hours", type: "text", span: "third" },
          { id: "supervisor-signature", label: "Signature of supervisor", type: "signature", span: "full" },
          { id: "supervisor-print-name", label: "Print name", type: "text", span: "half" },
          { id: "supervisor-sign-date", label: "Date", type: "date", span: "half" },
        ],
      },
    ],
  };
}

const BOARD_MEMBER_SCHEMA: NativeFormSchema = {
  formKey: "board-member",
  intro: {
    title: "ABCAC Board Member Application",
    paragraphs: [
      "Thank you for your interest in joining the Arizona Board for the Certification of Addiction Counselors (ABCAC) Board of Directors. Please complete the following application and attach your resume/CV in the Documents section of your portal.",
    ],
  },
  sections: [
    {
      id: "applicant",
      title: "Applicant Information",
      pdfPage: 1,
      fields: [
        { id: "full-name", label: "Full name", type: "text", required: true, span: "half" },
        { id: "preferred-name", label: "Preferred name (if different)", type: "text", span: "half" },
        { id: "email", label: "Email address", type: "text", required: true, span: "half" },
        { id: "phone", label: "Phone number", type: "text", required: true, span: "half" },
        { id: "mailing-address", label: "Mailing address", type: "text", required: true, span: "full" },
      ],
    },
    {
      id: "professional",
      title: "Professional Background",
      pdfPage: 1,
      fields: [
        { id: "job-title", label: "Current job title", type: "text", span: "half" },
        { id: "organization", label: "Organization / employer", type: "text", span: "half" },
        { id: "years-in-field", label: "Years in the behavioral health / addiction counseling field", type: "text", span: "half" },
      ],
    },
    {
      id: "certifications",
      title: "Certifications (check all that apply)",
      pdfPage: 1,
      fields: [
        { id: "cert-cadac", label: "CADAC", type: "check", span: "third" },
        { id: "cert-ccjp", label: "CCJP", type: "check", span: "third" },
        { id: "cert-aadc", label: "AADC", type: "check", span: "third" },
        { id: "cert-ccs", label: "CCS", type: "check", span: "third" },
        { id: "cert-cps", label: "CPS", type: "check", span: "third" },
        { id: "cert-cprs", label: "CPRS", type: "check", span: "third" },
        { id: "cert-other", label: "Other (please specify)", type: "text", span: "full" },
      ],
    },
    {
      id: "questions",
      title: "Application Questions",
      pdfPage: 2,
      fields: [
        { id: "why-join", label: "Why do you want to join the ABCAC Board?", type: "textarea", required: true, span: "full", hint: "Please provide a brief statement explaining your motivation." },
        { id: "strengths", label: "What strengths, skills, or expertise would you bring to the Board?", type: "textarea", required: true, span: "full" },
        { id: "experience", label: "What is your experience with professional certification, credentialing, or ethics in the behavioral health field?", type: "textarea", required: true, span: "full" },
      ],
    },
    {
      id: "availability",
      title: "Availability",
      pdfPage: 2,
      fields: [
        { id: "quarterly-meetings", label: "Are you available to attend quarterly board meetings (in person or virtually)?", type: "yesno", required: true, detailLabel: "If no, please explain" },
        { id: "committees", label: "Are you willing to participate in board committees or special projects as needed?", type: "yesno", required: true, detailLabel: "If no, please explain" },
      ],
    },
    {
      id: "acknowledgment",
      title: "Applicant Acknowledgment",
      pdfPage: 3,
      fields: [
        { id: "acknowledge", label: "I confirm that the information provided in this application is accurate and complete. I understand that submitting this application does not guarantee selection and that board membership is subject to board review and approval.", type: "check", required: true, span: "full" },
        { id: "signature", label: "Signature", type: "signature", required: true, span: "half" },
        { id: "signature-date", label: "Date", type: "date", required: true, span: "half" },
      ],
    },
  ],
};

const TESTING_ACCOMMODATIONS_SCHEMA: NativeFormSchema = {
  formKey: "testing-special-accommodations",
  intro: {
    title: "Request for Special Accommodations",
    paragraphs: [
      "If you have a disability that requires special testing accommodations, complete this request and have the Documentation of Disability-Related Needs section completed by an appropriate professional (physician, psychologist, psychiatrist).",
      "The information you provide and any documentation regarding your disability and your need for accommodations in testing will be treated with strict confidentiality. Psychological or psychiatric evaluations must have been conducted within the last three years; all medical/physical conditions require documentation of the treating physician's examination conducted within the previous three months (ADA guidelines).",
      "Submit at least one month prior to your desired exam date.",
    ],
  },
  sections: [
    {
      id: "request",
      title: "Candidate Information",
      pdfPage: 2,
      fields: [
        { id: "exam-date", label: "Preferred exam date", type: "date", required: true, span: "half" },
        { id: "exam-location", label: "Preferred exam location", type: "text", required: true, span: "half" },
        { id: "name", label: "Name", type: "text", required: true, span: "full" },
        { id: "home-address", label: "Home address", type: "text", required: true, span: "full" },
        { id: "city-state-zip", label: "City / State / ZIP", type: "text", required: true, span: "half" },
        { id: "phone", label: "Daytime telephone number", type: "text", required: true, span: "half" },
        { id: "email", label: "Email", type: "text", required: true, span: "half" },
      ],
    },
    {
      id: "exam",
      title: "IC&RC Examination (please check one)",
      pdfPage: 2,
      fields: [
        { id: "exam-adc", label: "ADC", type: "check", span: "third" },
        { id: "exam-aadc", label: "AADC", type: "check", span: "third" },
        { id: "exam-ccs", label: "CCS", type: "check", span: "third" },
        { id: "exam-ps", label: "PS", type: "check", span: "third" },
        { id: "exam-pr", label: "PR", type: "check", span: "third" },
        { id: "exam-ccjp", label: "CCJP", type: "check", span: "third" },
      ],
    },
    {
      id: "accommodations",
      title: "Accommodations Requested (check all that apply)",
      pdfPage: 2,
      fields: [
        { id: "acc-extended-time", label: "Extended testing time (time-and-a-half)", type: "check", span: "half" },
        { id: "acc-distraction-free", label: "Distraction-free room", type: "check", span: "half" },
        { id: "acc-reader", label: "Reader", type: "check", span: "half" },
        { id: "acc-scribe", label: "Scribe", type: "check", span: "half" },
        { id: "acc-seating", label: "Special seating or other physical accommodation", type: "check", span: "half" },
        { id: "acc-other", label: "Other special accommodations (please specify)", type: "text", span: "full" },
        { id: "comments", label: "Comments", type: "textarea", span: "full" },
        { id: "candidate-signature", label: "Signed", type: "signature", required: true, span: "half" },
        { id: "candidate-sign-date", label: "Date", type: "date", required: true, span: "half" },
      ],
    },
    {
      id: "professional-documentation",
      title: "Documentation of Disability-Related Needs",
      description: "This section must be completed by an appropriate professional (physician, psychologist, psychiatrist). Use “Invite signer” below to send it to them securely.",
      pdfPage: 1,
      signerSection: { role: "Documenting Professional" },
      fields: [
        { id: "prof-known-since", label: "I have known the exam candidate since", type: "date", span: "half" },
        { id: "prof-capacity", label: "In my capacity as (professional title)", type: "text", span: "half" },
        { id: "prof-description", label: "Description of disability and justification for accommodation(s)", type: "textarea", span: "full", hint: "The candidate discussed with me the nature of the exam to be administered. It is my professional opinion that, because of this candidate's disability described below, they should be accommodated by providing the special arrangements listed." },
        { id: "prof-signature", label: "Signed", type: "signature", span: "half" },
        { id: "prof-title", label: "Title", type: "text", span: "half" },
        { id: "prof-printed-name", label: "Printed name", type: "text", span: "half" },
        { id: "prof-license", label: "License number (if applicable)", type: "text", span: "half" },
        { id: "prof-address", label: "Address", type: "text", span: "full" },
        { id: "prof-city-state-zip", label: "City / State / ZIP", type: "text", span: "half" },
        { id: "prof-phone", label: "Telephone number", type: "text", span: "half" },
        { id: "prof-email", label: "Email", type: "text", span: "half" },
        { id: "prof-date", label: "Date", type: "date", span: "half" },
      ],
    },
  ],
};

const NATIVE_FORM_SCHEMAS: Record<string, NativeFormSchema> = {
  "recert-cac-cadac-aadc": recertificationSchema("recert-cac-cadac-aadc", "CAC/CADAC/AADC", "substance abuse"),
  "recert-cps": recertificationSchema("recert-cps", "Certified Prevention Specialist", "prevention and substance abuse"),
  "recert-ccs": recertificationSchema("recert-ccs", "Certified Clinical Supervisor", "clinical supervision and substance abuse"),
  "recert-ccjp": recertificationSchema("recert-ccjp", "Criminal Justice Addictions Professional", "criminal justice and substance abuse"),
  "recert-cprs": recertificationSchema("recert-cprs", "Certified Peer Recovery Specialist", "peer recovery and substance abuse"),
  "board-member": BOARD_MEMBER_SCHEMA,
  "testing-special-accommodations": TESTING_ACCOMMODATIONS_SCHEMA,
};

export function getNativeFormSchema(formKey: string): NativeFormSchema | undefined {
  return NATIVE_FORM_SCHEMAS[formKey];
}

export function tableFieldId(tableId: string, row: number, columnId: string) {
  return `${tableId}-r${row + 1}-${columnId}`;
}

function fieldToAnnotationType(type: NativeFieldType): AnnotationType {
  if (type === "yesno" || type === "textarea") return "text";
  return type;
}

/** All concrete input fields of a schema (sections + generated table cells). */
export function listNativeFields(schema: NativeFormSchema): Array<NativeField & { sectionId: string; pdfPage: number }> {
  return schema.sections.flatMap((section) => {
    const fields = (section.fields ?? []).map((field) => ({ ...field, sectionId: section.id, pdfPage: section.pdfPage }));
    const tableFields = section.table
      ? Array.from({ length: section.table.rows }, (_, row) =>
          section.table!.columns.map((column): NativeField & { sectionId: string; pdfPage: number } => ({
            id: tableFieldId(section.table!.id, row, column.id),
            label: `${column.label} (row ${row + 1})`,
            type: "text",
            sectionId: section.id,
            pdfPage: section.pdfPage,
          })),
        ).flat()
      : [];
    return [...fields, ...tableFields];
  });
}

/**
 * Signature fields exposed to the "invite signer" picker, in the same
 * SmartFormField shape the PDF detector produces so the workspace and signer
 * flow work identically for native forms.
 */
export function getNativeSignatureFields(schema: NativeFormSchema): SmartFormField[] {
  return schema.sections.flatMap((section) =>
    (section.fields ?? [])
      .filter((field) => field.type === "signature")
      .map((field) => ({
        id: field.id,
        page: section.pdfPage,
        x: 0,
        y: 0,
        width: 0.3,
        height: 0.03,
        type: "signature" as const,
        label: `${section.title} — ${field.label}`,
      })),
  );
}

/** Labels of required fields that have no value yet (used before confirming a form). */
export function missingRequiredNativeFields(schema: NativeFormSchema, annotations: FormAnnotation[]): string[] {
  const valueByFieldId = new Map(annotations.map((annotation) => [annotation.fieldId, annotation.value.trim()]));
  return schema.sections.flatMap((section) =>
    // Signer sections are completed by the invited signer, not the applicant.
    section.signerSection ? [] : (section.fields ?? [])
      .filter((field) => field.required && !(valueByFieldId.get(field.id) ?? "").length)
      .map((field) => field.label),
  );
}

/** Build the annotation written when a native field changes. */
export function makeNativeAnnotation(
  schema: NativeFormSchema,
  field: Pick<NativeField, "id" | "label" | "type">,
  pdfPage: number,
  value: string,
  author: "applicant" | "signer",
): FormAnnotation {
  return {
    id: `native-${schema.formKey}-${field.id}`,
    fieldId: field.id,
    page: pdfPage,
    x: 0,
    y: 0,
    width: 0.3,
    height: 0.03,
    label: field.label,
    value,
    type: fieldToAnnotationType(field.type),
    author,
  };
}
