import type { NativeFormSchema } from "@/lib/native-schemas/types";

// Continuing Education Endorsement Application (CEU workshop endorsement).
// Digitized from the scanned ABCAC form (Sections 1-10). The original PDF has
// no text layer, so this schema is the only fillable version.

export const CEU_WORKSHOP_SCHEMA: NativeFormSchema = {
  formKey: "ceu-workshop",
  intro: {
    title: "Continuing Education Endorsement Application",
    paragraphs: [
      "Submit this application no later than sixty (60) days PRIOR to the continuing education event. Applications received less than sixty (60) days in advance will be considered, but the endorsement process may not be completed before the event. Workshops may NOT be advertised as endorsed by ABCAC until you are notified of endorsement by the ABCAC office.",
      "Review fees: $100.00 for a program of eight (8) contact hours or less; $150.00 for nine (9) to fifteen (15) contact hours; $200.00 for a program over fifteen (15) contact hours. There is no additional charge for multiple presentations of the same educational program within two (2) years of ABCAC endorsement. The fee is paid at checkout.",
      "The ABCAC Board will screen applications for completeness and you will receive written approval or denial in approximately four (4) weeks from the date ABCAC receives your completed application. Education must be specifically related to the knowledge and skills necessary to perform the tasks within each IC&RC performance domain. All training must be accessible to the ABCAC Board free of charge; one or two board members may be assigned to attend on a random basis.",
    ],
  },
  sections: [
    {
      id: "sponsor",
      title: "Section 1 — Sponsor Identification",
      pdfPage: 3,
      fields: [
        { id: "application-date", label: "Date of application", type: "date", required: true, span: "half" },
        { id: "sponsor-name", label: "Name (agency / institution / business)", type: "text", required: true, span: "half" },
        { id: "sponsor-address", label: "Address", type: "text", required: true, span: "full" },
        { id: "sponsor-city-state-zip", label: "City / State / ZIP", type: "text", required: true, span: "half" },
        { id: "contact-person", label: "Contact person", type: "text", required: true, span: "half" },
        { id: "sponsor-tel", label: "Telephone", type: "text", required: true, span: "third" },
        { id: "sponsor-fax", label: "Fax", type: "text", span: "third" },
        { id: "sponsor-email", label: "Email", type: "text", required: true, span: "third" },
      ],
    },
    {
      id: "program",
      title: "Section 2 — Continuing Education Description",
      pdfPage: 3,
      fields: [
        { id: "program-title", label: "Title of program", type: "text", required: true, span: "full" },
        { id: "contact-hours", label: "Contact hours requested", type: "text", required: true, span: "half", hint: "One contact hour equals fifty (50) minutes of continuous, structured learning experience." },
        { id: "program-cost", label: "Total cost of program", type: "text", span: "half" },
        { id: "program-dates", label: "Date(s) of program", type: "text", required: true, span: "half" },
        { id: "program-location", label: "Location of presentation", type: "text", required: true, span: "half", hint: "Name of facility/building/organization/room number, etc." },
        { id: "program-address", label: "Address", type: "text", span: "half" },
        { id: "program-city-state-zip", label: "City / State / ZIP", type: "text", span: "half" },
      ],
    },
    {
      id: "schedule",
      title: "Section 3 — Schedule",
      description: "Provide a detailed event schedule outlining all contact hours. Details must include the times of each lecture/presentation and the instructors/facilitators responsible for each module. Attach the full schedule in the Documents section of your portal if it does not fit below.",
      pdfPage: 3,
      table: {
        id: "schedule-table",
        columns: [
          { id: "time", label: "Time", width: "narrow" },
          { id: "topic", label: "Lecture / presentation", width: "wide" },
          { id: "instructor", label: "Instructor / facilitator", width: "wide" },
        ],
        rows: 10,
      },
    },
    {
      id: "objectives",
      title: "Section 4 — Behavioral Objectives",
      description: "Describe the program's behavioral/learning objectives. A well written behavioral objective should include (1) a lead-in, (2) a content area, and (3) evaluation measures. Attach a copy of the full objectives in the Documents section if needed.",
      pdfPage: 4,
      fields: [
        { id: "behavioral-objectives", label: "Behavioral / learning objectives", type: "textarea", required: true, span: "full" },
      ],
    },
    {
      id: "core-functions",
      title: "Section 5 — Relationship to the 12 Core Functions",
      description: "Core function areas: 1. Screening, 2. Intake, 3. Orientation, 4. Assessment, 5. Treatment Planning, 6. Counseling, 7. Case Management, 8. Crisis Intervention, 9. Client Education, 10. Referral, 11. Record Keeping, 12. Consultation.",
      pdfPage: 4,
      fields: [
        { id: "professional-services-statement", label: "A. Statement linking the behavioral objectives of professional services to persons with chemical abuse problems", type: "textarea", required: true, span: "full", hint: "Chemical abuse problems should be broadly interpreted as applying to persons, groups, or families in which there is or has been an issue of chemical use, abuse or dependency, or which are at risk of developing such problems." },
        { id: "core-function-statement", label: "B. Identify the appropriate Counselor Core Function(s) the objectives address and link each Core Function to the objective", type: "textarea", required: true, span: "full" },
      ],
    },
    {
      id: "instructors",
      title: "Section 6 — Instructor / Facilitator Credentials",
      description: "List each instructor/facilitator with the education and experience background that qualifies them to present their identified topic. Education and experience may include course work, reading, continuing education, experience, research, authoring books and articles, and lesson and program writing.",
      pdfPage: 4,
      fields: [
        { id: "instructor-credentials", label: "Instructor / facilitator credentials", type: "textarea", required: true, span: "full", hint: "Attach resumes or CVs in the Documents section of your portal." },
      ],
    },
    {
      id: "evaluation",
      title: "Section 7 — Evaluation Instruments",
      description: "The participant critique/evaluation instrument must at minimum address: accomplishment of program objectives; instructors' knowledge of the topic; instructors' presentation skills; program strengths and weaknesses; appropriateness of the learning environment; and a general comments section. Attach a copy in the Documents section.",
      pdfPage: 5,
      fields: [
        { id: "attendance-verification", label: "A. Procedures for verifying and recording participants' attendance", type: "textarea", required: true, span: "full" },
        { id: "attendance-records", label: "B. Procedures for maintaining records of attendance for a minimum of 2 years", type: "textarea", required: true, span: "full" },
      ],
    },
    {
      id: "certificate",
      title: "Section 8 — Certificate of Completion",
      description: "Attach a copy of the certificate of completion provided to each participant. It must include: the sponsoring agency's name; title and date of seminar; participant's name; number of contact hours authorized; ABCAC endorsement & provider number; and an authorized signature. Upload it in the Documents section of your portal.",
      pdfPage: 5,
      fields: [
        { id: "certificate-confirm", label: "I will provide a certificate of completion meeting all six requirements above", type: "check", required: true, span: "full" },
      ],
    },
    {
      id: "other-information",
      title: "Section 9 — Other Information",
      description: "Attach any additional information helpful for a full evaluation and review of this educational program, including a copy of the program outline and relevant aids and handouts. No more than two members of the ABCAC Educational Review Committee shall be authorized to monitor the presentation at no charge; such members shall be provided with a certificate of attendance.",
      pdfPage: 5,
      fields: [
        { id: "other-information", label: "Additional information", type: "textarea", span: "full" },
      ],
    },
    {
      id: "authentication",
      title: "Section 10 — Authentication",
      pdfPage: 5,
      fields: [
        { id: "attestation", label: "I hereby attest that the information provided in this application is valid and that the material presented in this education package is not in any violation of copyright laws and does not conflict with any ethical code established for the addictions field.", type: "check", required: true, span: "full" },
        { id: "authorized-signature", label: "Authorized signature", type: "signature", required: true, span: "third" },
        { id: "authorized-printed-name", label: "Printed name", type: "text", required: true, span: "third" },
        { id: "authorized-date", label: "Date", type: "date", required: true, span: "third" },
      ],
    },
  ],
};
